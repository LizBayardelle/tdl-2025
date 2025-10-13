class ConceptSource < ApplicationRecord
  belongs_to :concept
  belongs_to :source

  # Enums
  enum :role, {
    primary: "primary",
    recommended: "recommended",
    critical_review: "critical_review",
    protocol: "protocol",
    supplementary: "supplementary"
  }, prefix: true

  # Validations
  validates :concept_id, presence: true
  validates :source_id, presence: true
  validates :concept_id, uniqueness: { scope: :source_id }
end
