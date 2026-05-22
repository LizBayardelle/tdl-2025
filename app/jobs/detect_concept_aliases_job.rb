class DetectConceptAliasesJob < ApplicationJob
  queue_as :default

  def perform(concept_id)
    concept = Concept.find_by(id: concept_id)
    return unless concept

    result = ConceptAliasDetectionService.new(concept).detect

    create_alias_notifications(concept, result[:aliases]) if result[:aliases].any?
    auto_create_related_connections(concept, result[:related]) if result[:related].any?
  end

  private

  # One notification per (new_concept, candidate) pair.  The user reviews
  # each pair independently with three options: keep new, keep existing,
  # or "these are different things".
  def create_alias_notifications(concept, aliases_data)
    aliases_data.each do |a|
      other = Concept.find_by(id: a[:id])
      next unless other && other.user_id == concept.user_id

      next if ConceptDisambiguation.exists_for?(concept.user, concept, other)
      next if pair_notification_exists?(concept, other)

      Notification.create!(
        user_id: concept.user_id,
        kind: Notification::KIND_CONCEPT_ALIAS_SUGGESTION,
        payload: build_pair_payload(concept, other, a[:confidence], a[:reasoning], "autodetect")
      )
    end
  end

  def build_pair_payload(x, y, confidence, reasoning, source)
    a, b = [x, y].sort_by(&:id)
    {
      concept_a_id: a.id,
      concept_a_label: a.label,
      concept_b_id: b.id,
      concept_b_label: b.label,
      confidence: confidence,
      reasoning: reasoning,
      source: source
    }
  end

  def pair_notification_exists?(x, y)
    a_id, b_id = [x.id, y.id].sort
    Notification
      .where(user_id: x.user_id, kind: Notification::KIND_CONCEPT_ALIAS_SUGGESTION, status: Notification::STATUS_PENDING)
      .where("(payload->>'concept_a_id')::bigint = :a AND (payload->>'concept_b_id')::bigint = :b", a: a_id, b: b_id)
      .exists?
  end

  def auto_create_related_connections(concept, related_data)
    related_data.each do |r|
      params = Connection.normalize_relationship_params(concept.id, r[:id], r[:rel_type])
      next if params[:src_concept_id] == params[:dst_concept_id]

      Connection.find_or_create_by!(
        user_id: concept.user_id,
        src_concept_id: params[:src_concept_id],
        dst_concept_id: params[:dst_concept_id],
        rel_type: params[:rel_type]
      )
    rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
      Rails.logger.warn "DetectConceptAliasesJob related connection failed: #{e.message}"
    end
  end
end
