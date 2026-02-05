class Concept < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :concept_sources, dependent: :destroy
  has_many :sources, through: :concept_sources
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :people, through: :people_concepts
  has_many :notes, dependent: :destroy  # Legacy: notes with concept_id pointing here
  has_many :concept_notes, dependent: :destroy
  has_many :linked_notes, through: :concept_notes, source: :note  # Many-to-many notes
  has_many :outgoing_connections, class_name: 'Connection', foreign_key: 'src_concept_id', dependent: :destroy
  has_many :incoming_connections, class_name: 'Connection', foreign_key: 'dst_concept_id', dependent: :destroy

  # Enums
  enum :node_type, {
    undeclared: "undeclared",
    concept: "concept",
    theory: "theory",
    method: "method",
    measure: "measure",
    entity: "entity",
    category: "category",
    subject: "subject",
    other: "other",
    # Legacy values (kept for backwards compatibility)
    model: "model",
    technique: "technique",
    construct: "construct",
    population: "population",
    discipline: "discipline",
    school_of_thought: "school_of_thought",
    structure: "structure"
  }, prefix: true

  enum :level_status, {
    mapped: "mapped",
    basic: "basic",
    deep: "deep"
  }, prefix: true

  # Validations
  validates :label, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :node_type, presence: true
  validates :user_id, presence: true

  # Callbacks
  before_validation :generate_slug, if: -> { label.present? && slug.blank? }

  # Scopes
  scope :recent, -> { order(updated_at: :desc) }
  scope :by_type, ->(type) { where(node_type: type) }
  scope :by_status, ->(status) { where(level_status: status) }
  scope :needs_review, -> { where("last_reviewed_on IS NULL OR last_reviewed_on < ?", 30.days.ago) }

  # Count methods for JSON serialization
  def sources_count
    sources.size
  end

  def people_count
    people.size
  end

  def notes_count
    linked_notes.size
  end

  def tags_count
    tags.size
  end

  private

  def generate_slug
    self.slug = label.parameterize
  end
end
