class Person < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :concepts, through: :people_concepts
  has_many :people_sources, class_name: 'PersonSource', dependent: :destroy
  has_many :sources, through: :people_sources
  has_many :people_notes, class_name: 'PersonNote', dependent: :destroy
  has_many :notes, through: :people_notes

  # Enums
  enum :role, {
    theorist: "theorist",
    clinician: "clinician",
    researcher: "researcher",
    peer: "peer",
    client: "client"
  }, prefix: true

  # Validations
  validates :full_name, presence: true
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_role, ->(role) { where(role: role) }
  scope :alphabetical, -> { order(:full_name) }

  # Get all connections involving this person's concepts
  def related_connections
    concept_ids = concepts.pluck(:id)
    return Connection.none if concept_ids.empty?

    Connection.where("src_concept_id IN (?) OR dst_concept_id IN (?)", concept_ids, concept_ids)
              .includes(:src_concept, :dst_concept)
              .order(created_at: :desc)
  end
end
