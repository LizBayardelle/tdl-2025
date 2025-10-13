class Note < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :node, optional: true

  # Enums
  enum :note_type, {
    reflection: "reflection",
    question: "question",
    insight: "insight",
    critique: "critique",
    application: "application",
    synthesis: "synthesis"
  }, prefix: true

  # Validations
  validates :body, presence: true
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(note_type: type) }
  scope :pinned, -> { where(pinned: true) }
  scope :for_node, ->(node_id) { where(node_id: node_id) }
  scope :unattached, -> { where(node_id: nil) }
end
