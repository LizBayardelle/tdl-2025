class PersonConcept < ApplicationRecord
  belongs_to :person
  belongs_to :concept

  # Enums
  enum :rel_type, {
    authored: "authored",
    uses: "uses",
    studies: "studies",
    exemplifies: "exemplifies",
    influenced: "influenced",
    critiqued: "critiqued"
  }, prefix: true

  # Validations
  validates :person_id, presence: true
  validates :concept_id, presence: true
  validates :person_id, uniqueness: { scope: :concept_id }
  validates :strength, inclusion: { in: 1..5 }, allow_nil: true
  validates :confidence, inclusion: { in: 0.0..1.0 }, allow_nil: true
end
