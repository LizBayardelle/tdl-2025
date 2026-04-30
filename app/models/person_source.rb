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

  # Keep Source#authors string in lockstep with the people linked to the
  # source, so every save path (manual create, PDF upload, bulk import)
  # ends up with both the relational data and a string for citations.
  after_create_commit :refresh_source_authors_string

  private

  def refresh_source_authors_string
    source&.sync_authors_string_from_people!
  end
end
