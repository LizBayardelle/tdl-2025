class Note < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :concept, optional: true
  has_many :note_links, dependent: :destroy
  has_many :person_notes, dependent: :destroy
  has_many :people, through: :person_notes

  # Enums
  enum :note_type, {
    reflection: "reflection",
    question: "question",
    insight: "insight",
    critique: "critique",
    application: "application",
    synthesis: "synthesis"
  }, prefix: true

  # Validations
  validates :body, presence: true
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(note_type: type) }
  scope :pinned, -> { where(pinned: true) }
  scope :for_concept, ->(concept_id) { where(concept_id: concept_id) }
  scope :unattached, -> { where(concept_id: nil) }
end
