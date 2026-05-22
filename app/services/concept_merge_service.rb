class ConceptMergeService
  class Error < StandardError; end

  # Hard-merges `loser` into `winner`. Repoints all associations from loser →
  # winner, pushes loser's label + aliases into winner.aliases, then deletes
  # loser. Both concepts must belong to the same user.
  def self.call(winner:, loser:)
    new(winner: winner, loser: loser).call
  end

  def initialize(winner:, loser:)
    @winner = winner
    @loser = loser
  end

  def call
    raise Error, "winner and loser must be different concepts" if @winner.id == @loser.id
    raise Error, "concepts must belong to the same user" if @winner.user_id != @loser.user_id

    Concept.transaction do
      repoint_simple_concept_id_assoc(ConceptDomain, unique_on: :domain_id)
      repoint_simple_concept_id_assoc(ConceptSource, unique_on: :source_id)
      repoint_simple_concept_id_assoc(ConceptNote, unique_on: :note_id)
      repoint_simple_concept_id_assoc(DismissedConceptNote, unique_on: :note_id)
      repoint_simple_concept_id_assoc(PersonConcept, unique_on: :person_id)
      Note.where(concept_id: @loser.id).update_all(concept_id: @winner.id)

      repoint_connections
      repoint_polymorphic("Tagging", "taggable_type", "taggable_id", unique_scope: :tag_id)
      repoint_polymorphic("Linking", "linkable_type", "linkable_id", unique_scope: :link_id)
      repoint_polymorphic("Share", "shareable_type", "shareable_id", unique_scope: nil)
      repoint_polymorphic("CollectionItem", "collectable_type", "collectable_id", unique_scope: nil)

      merge_aliases
      merge_tags_array
      cascade_disambiguations
      dismiss_stale_notifications

      @loser.reload.destroy!
    end

    @winner.reload
  end

  private

  # For join models with `concept_id` and a unique index on (concept_id, X),
  # delete duplicates in loser that already exist on winner, then repoint.
  def repoint_simple_concept_id_assoc(model_class, unique_on:)
    winner_keys = model_class.where(concept_id: @winner.id).pluck(unique_on)
    if winner_keys.any?
      model_class.where(concept_id: @loser.id, unique_on => winner_keys).delete_all
    end
    model_class.where(concept_id: @loser.id).update_all(concept_id: @winner.id)
  end

  def repoint_connections
    # Outgoing: src=loser → src=winner. Drop self-loops (loser → winner becomes
    # winner → winner) and conflicts on (src, dst, rel_type) unique scope.
    Connection.where(src_concept_id: @loser.id).find_each do |conn|
      if conn.dst_concept_id == @winner.id
        conn.destroy!
        next
      end
      existing = Connection.find_by(
        src_concept_id: @winner.id,
        dst_concept_id: conn.dst_concept_id,
        rel_type: conn.rel_type
      )
      if existing
        conn.destroy!
      else
        conn.update_columns(src_concept_id: @winner.id)
      end
    end

    Connection.where(dst_concept_id: @loser.id).find_each do |conn|
      if conn.src_concept_id == @winner.id
        conn.destroy!
        next
      end
      existing = Connection.find_by(
        src_concept_id: conn.src_concept_id,
        dst_concept_id: @winner.id,
        rel_type: conn.rel_type
      )
      if existing
        conn.destroy!
      else
        conn.update_columns(dst_concept_id: @winner.id)
      end
    end
  end

  def repoint_polymorphic(class_name, type_col, id_col, unique_scope:)
    klass = class_name.safe_constantize
    return unless klass

    loser_rows = klass.where(type_col => "Concept", id_col => @loser.id)

    if unique_scope
      winner_keys = klass.where(type_col => "Concept", id_col => @winner.id).pluck(unique_scope)
      if winner_keys.any?
        loser_rows.where(unique_scope => winner_keys).delete_all
      end
      loser_rows = klass.where(type_col => "Concept", id_col => @loser.id)
    end

    loser_rows.update_all(id_col => @winner.id)
  end

  def merge_aliases
    combined = (Array(@winner.aliases) + Array(@loser.aliases) + [@loser.label]).map(&:to_s).map(&:strip).reject(&:blank?)
    canonical = @winner.label.to_s.strip.downcase
    deduped = combined.uniq { |a| a.downcase }.reject { |a| a.downcase == canonical }
    @winner.update!(aliases: deduped)
  end

  def merge_tags_array
    combined = (Array(@winner.tags) + Array(@loser.tags)).map(&:to_s).map(&:strip).reject(&:blank?).uniq
    @winner.update_columns(tags: combined) if combined != Array(@winner.tags)
  end

  # When a concept is merged, its disambiguation history needs to follow.
  #   1. Drop any (loser, winner) row in either ordering — the user said they
  #      were different, but they're being merged now, so that decision is moot.
  #   2. For (loser, X) rows where X != winner: rewrite to (winner, X) with
  #      ordering normalized.  If a row already exists for (winner, X), drop
  #      the loser's row instead of inserting a duplicate.
  # Bare concept deletion is handled by the FK ON DELETE CASCADE.
  def cascade_disambiguations
    pair_lo, pair_hi = [@winner.id, @loser.id].sort
    ConceptDisambiguation
      .where(user_id: @loser.user_id, concept_a_id: pair_lo, concept_b_id: pair_hi)
      .delete_all

    ConceptDisambiguation
      .where(user_id: @loser.user_id)
      .where("concept_a_id = :id OR concept_b_id = :id", id: @loser.id)
      .find_each do |row|
        other_id = row.concept_a_id == @loser.id ? row.concept_b_id : row.concept_a_id
        new_lo, new_hi = [@winner.id, other_id].sort

        existing = ConceptDisambiguation.find_by(
          user_id: @loser.user_id, concept_a_id: new_lo, concept_b_id: new_hi
        )
        if existing
          row.destroy!
        else
          row.update!(concept_a_id: new_lo, concept_b_id: new_hi)
        end
      end
  end

  # Any pending alias-suggestion notification that references the loser as
  # candidate or as a suggested winner is now stale (the loser is about to be
  # deleted).  Dismiss them so the user isn't shown ghost suggestions.
  def dismiss_stale_notifications
    Notification
      .where(user_id: @loser.user_id, status: Notification::STATUS_PENDING, kind: Notification::KIND_CONCEPT_ALIAS_SUGGESTION)
      .where(
        "(payload->>'candidate_concept_id')::bigint = :id " \
        "OR payload->'suggestions' @> :json " \
        "OR (payload->>'concept_a_id')::bigint = :id " \
        "OR (payload->>'concept_b_id')::bigint = :id",
        id: @loser.id, json: [{ id: @loser.id }].to_json
      )
      .update_all(status: Notification::STATUS_DISMISSED, acted_at: Time.current, updated_at: Time.current)
  end
end
