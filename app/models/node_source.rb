class NodeSource < ApplicationRecord
  belongs_to :node
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
  validates :node_id, presence: true
  validates :source_id, presence: true
  validates :node_id, uniqueness: { scope: :source_id }
end
