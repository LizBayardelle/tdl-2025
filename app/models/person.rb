class Person < ApplicationRecord
  include Taggable
  include Shareable

  belongs_to :user
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :concepts, through: :people_concepts
  has_many :people_sources, class_name: 'PersonSource', dependent: :restrict_with_error
  has_many :sources, through: :people_sources
  has_many :people_notes, class_name: 'PersonNote', dependent: :restrict_with_error
  has_many :notes, through: :people_notes

  # Enums
  enum :role, {
    theorist: "theorist",
    clinician: "clinician",
    researcher: "researcher",
    peer: "peer",
    client: "client"
  }, prefix: true

  # Callbacks
  before_validation :build_full_name

  # Validations
  validates :user_id, presence: true
  validate :name_presence
  validate :links_well_formed

  # A link is { "label" => String, "url" => String }. Free-form label so users can name
  # whatever platform they want without us pre-committing a taxonomy.
  def links=(value)
    super(Array(value).map do |link|
      next nil unless link.is_a?(Hash)
      {
        'label' => link['label'].to_s.strip,
        'url' => link['url'].to_s.strip
      }
    end.compact)
  end

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_role, ->(role) { where(role: role) }
  scope :alphabetical, -> { order(:full_name) }

  private

  def build_full_name
    # If we have component name fields, construct full_name from them
    if first_name.present? || last_name.present?
      parts = [first_name, middle_name, last_name].compact.reject(&:blank?)
      self.full_name = parts.join(' ') if parts.any?
    end
  end

  def name_presence
    if full_name.blank? && first_name.blank? && last_name.blank?
      errors.add(:base, "Must provide either full name or first/last name")
    end
  end

  def links_well_formed
    return if links.blank?
    links.each_with_index do |link, i|
      errors.add(:links, "entry #{i + 1} must have a url") if link['url'].blank?
    end
  end

  public

  # An author's concept reach: concepts tagged directly on this Person plus
  # concepts attached to any source they've authored.  This is "what they
  # work on" in a meaningful sense, not just what we've manually linked.
  def effective_concept_ids
    direct = concept_ids
    via = ConceptSource
      .joins("INNER JOIN people_sources ON people_sources.source_id = concept_sources.source_id")
      .where(people_sources: { person_id: id })
      .pluck(:concept_id)
    (direct + via).uniq
  end

  def effective_concepts
    Concept.where(id: effective_concept_ids)
  end

  # Batched version for index pages — single pair of queries regardless of
  # how many people you're hydrating.  Returns { person_id => [concept_ids] }.
  def self.effective_concept_ids_for(person_ids)
    return {} if person_ids.blank?

    direct = PersonConcept
      .where(person_id: person_ids)
      .pluck(:person_id, :concept_id)

    via = ConceptSource
      .joins("INNER JOIN people_sources ON people_sources.source_id = concept_sources.source_id")
      .where(people_sources: { person_id: person_ids })
      .pluck(Arel.sql("people_sources.person_id"), :concept_id)

    (direct + via)
      .group_by(&:first)
      .transform_values { |rows| rows.map(&:last).uniq }
  end

  # Tag reach: tags applied to this Person plus tags applied to any source
  # they've authored.  Matched by name (the string the user types) since
  # tag IDs aren't stable across users.
  def effective_tag_names
    direct = tags.pluck(:name)
    src_ids = source_ids
    return direct.uniq if src_ids.empty?
    via_tag_ids = Tagging
      .where(taggable_type: 'Source', taggable_id: src_ids)
      .pluck(:tag_id)
    via_names = Tag.where(id: via_tag_ids).pluck(:name)
    (direct + via_names).uniq
  end

  def self.effective_tag_names_for(person_ids)
    return {} if person_ids.blank?

    direct = Tagging
      .joins("INNER JOIN tags ON tags.id = taggings.tag_id")
      .where(taggable_type: 'Person', taggable_id: person_ids)
      .pluck(Arel.sql("taggings.taggable_id"), Arel.sql("tags.name"))

    via = Tagging
      .joins("INNER JOIN tags ON tags.id = taggings.tag_id")
      .joins("INNER JOIN people_sources ON people_sources.source_id = taggings.taggable_id AND taggings.taggable_type = 'Source'")
      .where(people_sources: { person_id: person_ids })
      .pluck(Arel.sql("people_sources.person_id"), Arel.sql("tags.name"))

    (direct + via)
      .group_by(&:first)
      .transform_values { |rows| rows.map(&:last).uniq }
  end

  # Collection reach: collections this Person is in plus collections any of
  # their authored sources are in.
  def effective_collection_ids
    direct = CollectionItem
      .where(collectable_type: 'Person', collectable_id: id)
      .pluck(:collection_id)
    src_ids = source_ids
    return direct.uniq if src_ids.empty?
    via = CollectionItem
      .where(collectable_type: 'Source', collectable_id: src_ids)
      .pluck(:collection_id)
    (direct + via).uniq
  end

  def self.effective_collection_ids_for(person_ids)
    return {} if person_ids.blank?

    direct = CollectionItem
      .where(collectable_type: 'Person', collectable_id: person_ids)
      .pluck(Arel.sql("collectable_id"), :collection_id)

    via = CollectionItem
      .joins("INNER JOIN people_sources ON people_sources.source_id = collection_items.collectable_id AND collection_items.collectable_type = 'Source'")
      .where(people_sources: { person_id: person_ids })
      .pluck(Arel.sql("people_sources.person_id"), :collection_id)

    (direct + via)
      .group_by(&:first)
      .transform_values { |rows| rows.map(&:last).uniq }
  end

  # Get all connections involving this person's concepts
  def related_connections
    concept_ids = concepts.pluck(:id)
    return Connection.none if concept_ids.empty?

    Connection.where("src_concept_id IN (?) OR dst_concept_id IN (?)", concept_ids, concept_ids)
              .includes(:src_concept, :dst_concept)
              .order(created_at: :desc)
  end

  # Other people who share research territory with this one.
  # Score = 2 × co-authored sources + 1 × shared concepts.  Co-authorship is
  # the stronger signal so it gets the higher weight.  Returns up to `limit`
  # results, owned by `viewer` only (no cross-user data leakage).
  #
  # Returns an Array<Hash> of { id:, full_name:, role:, orcid:,
  # shared_sources_count:, shared_concepts_count:, score: } sorted by score desc.
  def related_people(viewer:, limit: 8)
    source_ids  = sources.pluck(:id)
    concept_ids = concepts.pluck(:id)
    return [] if source_ids.empty? && concept_ids.empty?

    scoped = viewer.people.where.not(id: id)

    coauthor_counts = source_ids.empty? ? {} :
      PersonSource
        .where(source_id: source_ids, person_id: scoped.select(:id))
        .group(:person_id)
        .count

    concept_counts = concept_ids.empty? ? {} :
      PersonConcept
        .where(concept_id: concept_ids, person_id: scoped.select(:id))
        .group(:person_id)
        .count

    candidate_ids = (coauthor_counts.keys + concept_counts.keys).uniq
    return [] if candidate_ids.empty?

    candidates = scoped.where(id: candidate_ids).index_by(&:id)

    rows = candidate_ids.map do |pid|
      person = candidates[pid]
      next nil unless person
      shared_sources  = coauthor_counts[pid] || 0
      shared_concepts = concept_counts[pid]  || 0
      {
        id: pid,
        full_name: person.full_name,
        role: person.role,
        orcid: person.orcid,
        shared_sources_count:  shared_sources,
        shared_concepts_count: shared_concepts,
        score: (shared_sources * 2) + shared_concepts,
      }
    end.compact

    rows.sort_by { |r| [-r[:score], r[:full_name].to_s.downcase] }.first(limit)
  end
end
