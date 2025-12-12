class ConceptNote < ApplicationRecord
  belongs_to :note
  belongs_to :concept
end
