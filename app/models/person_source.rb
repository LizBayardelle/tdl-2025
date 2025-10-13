class PersonSource < ApplicationRecord
  self.table_name = 'people_sources'

  belongs_to :person
  belongs_to :source

  # Enums
  enum :role, {
    author: "author",
    editor: "editor",
    critic: "critic",
    subject_of: "subject_of",
    translator: "translator",
    contributor: "contributor"
  }, prefix: true

  # Validations
  validates :person_id, presence: true
  validates :source_id, presence: true
  validates :person_id, uniqueness: { scope: :source_id }
  validates :confidence, inclusion: { in: 0.0..1.0 }, allow_nil: true
end
