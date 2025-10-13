class Concept < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :concept_sources, dependent: :destroy
  has_many :sources, through: :concept_sources
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :people, through: :people_concepts
  has_many :notes, dependent: :destroy

  # Enums
  enum :node_type, {
    model: "model",
    technique: "technique",
    mechanism: "mechanism",
    construct: "construct",
    measure: "measure",
    population: "population"
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

  private

  def generate_slug
    self.slug = label.parameterize
  end
end
