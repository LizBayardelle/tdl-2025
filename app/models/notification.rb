class Notification < ApplicationRecord
  KIND_CONCEPT_ALIAS_SUGGESTION = "concept_alias_suggestion".freeze

  KINDS = [
    KIND_CONCEPT_ALIAS_SUGGESTION
  ].freeze

  STATUS_PENDING = "pending".freeze
  STATUS_APPROVED = "approved".freeze
  STATUS_DISMISSED = "dismissed".freeze

  STATUSES = [STATUS_PENDING, STATUS_APPROVED, STATUS_DISMISSED].freeze

  belongs_to :user

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: STATUS_PENDING) }
  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  def pending?
    status == STATUS_PENDING
  end

  def mark_read!
    update!(read_at: Time.current) if read_at.nil?
  end

  def approve!
    update!(status: STATUS_APPROVED, acted_at: Time.current)
  end

  def dismiss!
    update!(status: STATUS_DISMISSED, acted_at: Time.current)
  end
end
