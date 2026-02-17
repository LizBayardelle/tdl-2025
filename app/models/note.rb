class Note < ApplicationRecord
  include Taggable
  include Shareable

  belongs_to :user
  belongs_to :concept, optional: true  # Legacy single concept
  belongs_to :source, optional: true
  has_many :note_links, dependent: :destroy
  has_many :person_notes, dependent: :destroy
  has_many :people, through: :person_notes

  # Many-to-many concepts
  has_many :concept_notes, dependent: :destroy
  has_many :concepts, through: :concept_notes

  # Enums
  enum :note_type, {
    note: "note",
    question: "question",
    synthesis: "synthesis",
    connection: "connection",
    todo: "todo"
  }, prefix: true

  # Validations
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(pinned: :desc, created_at: :desc) }
  scope :by_type, ->(type) { where(note_type: type) }
  scope :pinned, -> { where(pinned: true) }
  scope :for_concept, ->(concept_id) { where(concept_id: concept_id) }
  scope :unattached, -> { where(concept_id: nil) }
end
