class Person < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :people_concepts, dependent: :destroy
  has_many :concepts, through: :people_concepts
  has_many :person_sources, dependent: :destroy
  has_many :sources, through: :person_sources
  has_many :person_notes, dependent: :destroy
  has_many :notes, through: :person_notes

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
end
