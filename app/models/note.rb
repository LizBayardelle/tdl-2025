class Note < ApplicationRecord
  include Taggable
  include Shareable

  belongs_to :user
  belongs_to :concept, optional: true  # Legacy single concept
  # `source` is the *primary* source — the one whose page/quote the note's
  # highlight (if any) belongs to. `linked_sources` is the broader list of
  # sources this note attaches to. Saves keep them in sync: source_id always
  # equals one of the note_sources rows.
  belongs_to :source, optional: true
  has_many :note_sources, dependent: :destroy
  has_many :linked_sources, through: :note_sources, source: :source
  has_many :note_links, dependent: :destroy
  has_many :person_notes, dependent: :destroy
  has_many :people, through: :person_notes
  has_one :highlight, dependent: :destroy

  # Many-to-many concepts
  has_many :concept_notes, dependent: :destroy
  has_many :concepts, through: :concept_notes

  # Collections (polymorphic)
  has_many :collection_items, as: :collectable, dependent: :destroy
  has_many :collections, through: :collection_items

  # Enums
  enum :note_type, {
    note: "note",
    highlight: "highlight",
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
