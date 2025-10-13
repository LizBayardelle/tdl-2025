class Edge < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :src, class_name: "Node", foreign_key: "src_id"
  belongs_to :dst, class_name: "Node", foreign_key: "dst_id"

  # Enums
  enum :rel_type, {
    adjacent: "adjacent",
    contrasts_with: "contrasts_with",
    integrates_with: "integrates_with",
    builds_on: "builds_on",
    subsumes: "subsumes"
  }, prefix: true

  # Validations
  validates :src_id, presence: true
  validates :dst_id, presence: true
  validates :rel_type, presence: true
  validates :user_id, presence: true
  validates :src_id, uniqueness: { scope: :dst_id }
  validates :strength, inclusion: { in: 1..5 }, allow_nil: true
  validate :cannot_link_to_self

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(rel_type: type) }
  scope :by_strength, ->(strength) { where(strength: strength) }
  scope :from_node, ->(node_id) { where(src_id: node_id) }
  scope :to_node, ->(node_id) { where(dst_id: node_id) }
  scope :for_node, ->(node_id) { where("src_id = ? OR dst_id = ?", node_id, node_id) }

  private

  def cannot_link_to_self
    if src_id == dst_id
      errors.add(:dst_id, "cannot link a construct to itself")
    end
  end
end
