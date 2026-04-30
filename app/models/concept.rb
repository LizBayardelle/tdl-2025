class Concept < ApplicationRecord
  include Shareable
  include Taggable

  CONCEPT_TYPES = %w[
    phenomenon theory pathology anatomy intervention
    process measurement method field
  ].freeze

  belongs_to :user
  belongs_to :definition, class_name: "ConceptDefinition", optional: true

  has_many :concept_domains, dependent: :destroy
  has_many :domains, through: :concept_domains

  has_many :concept_sources, dependent: :destroy
  has_many :sources, through: :concept_sources
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :people, through: :people_concepts
  has_many :notes, dependent: :destroy  # Legacy: notes with concept_id pointing here
  has_many :concept_notes, dependent: :destroy
  has_many :linked_notes, through: :concept_notes, source: :note  # Many-to-many notes
  has_many :outgoing_connections, class_name: 'Connection', foreign_key: 'src_concept_id', dependent: :destroy
  has_many :incoming_connections, class_name: 'Connection', foreign_key: 'dst_concept_id', dependent: :destroy
  has_many :linkings, as: :linkable, dependent: :destroy
  has_many :links, through: :linkings

  # Validations
  validates :label, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :user_id, presence: true

  # Callbacks
  before_validation :generate_slug, if: -> { label.present? && slug.blank? }
  after_create :auto_classify_type, if: -> { concept_type.blank? }

  # Scopes
  scope :recent, -> { order(updated_at: :desc) }
  scope :by_type, ->(type) { where(concept_type: type) }
  scope :needs_review, -> { where("last_reviewed_on IS NULL OR last_reviewed_on < ?", 30.days.ago) }

  # Returns the effective concept_type — from definition if linked, otherwise own field
  def effective_concept_type
    definition&.concept_type || concept_type
  end

  # Count methods for JSON serialization
  def sources_count
    sources.size
  end

  def people_count
    people.size
  end

  # People associated with this concept either directly (tagged on the concept)
  # or transitively (an author of a source tagged with this concept).  Used by
  # the index payload so the People column reflects both routes.
  def all_people_ids
    direct = people.pluck(:id)
    via_sources = source_ids.any? ? PersonSource.where(source_id: source_ids).pluck(:person_id) : []
    (direct + via_sources).uniq
  end

  def all_people_count
    all_people_ids.size
  end

  def notes_count
    linked_notes.size
  end

  def tags_count
    tags.size
  end

  def collections_count
    collections.size
  end

  private

  def generate_slug
    self.slug = label.parameterize
  end

  def auto_classify_type
    ClassifyConceptTypeJob.perform_later(id)
  end
end
