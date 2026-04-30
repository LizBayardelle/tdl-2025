class NoteSource < ApplicationRecord
  belongs_to :note
  belongs_to :source

  validates :source_id, uniqueness: { scope: :note_id }
end
