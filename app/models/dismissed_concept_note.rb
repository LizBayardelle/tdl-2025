class DismissedConceptNote < ApplicationRecord
  belongs_to :concept
  belongs_to :note

  validates :concept_id, uniqueness: { scope: :note_id }
end
