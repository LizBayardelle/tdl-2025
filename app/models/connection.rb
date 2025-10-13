class Connection < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :src_concept, class_name: "Concept", foreign_key: "src_concept_id"
  belongs_to :dst_concept, class_name: "Concept", foreign_key: "dst_concept_id"

  # Enums
  enum :rel_type, {
    authored: "authored",
    influenced: "influenced",
    contrasts_with: "contrasts_with",
    integrates_with: "integrates_with",
    derived_from: "derived_from",
    applies_to: "applies_to",
    treats: "treats",
    associated_with: "associated_with",
    critiques: "critiques",
    supports: "supports",
    related_to: "related_to"
  }, prefix: true

  # Validations
  validates :src_concept_id, presence: true
  validates :dst_concept_id, presence: true
  validates :rel_type, presence: true
  validates :user_id, presence: true
  validates :src_concept_id, uniqueness: { scope: :dst_concept_id }
  validates :strength, inclusion: { in: 1..5 }, allow_nil: true
  validate :cannot_link_to_self

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(rel_type: type) }
  scope :by_strength, ->(strength) { where(strength: strength) }
  scope :from_concept, ->(concept_id) { where(src_concept_id: concept_id) }
  scope :to_concept, ->(concept_id) { where(dst_concept_id: concept_id) }
  scope :for_concept, ->(concept_id) { where("src_concept_id = ? OR dst_concept_id = ?", concept_id, concept_id) }

  private

  def cannot_link_to_self
    if src_concept_id == dst_concept_id
      errors.add(:dst_concept_id, "cannot link a concept to itself")
    end
  end
end
