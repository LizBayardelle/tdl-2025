class Subscription < ApplicationRecord
  belongs_to :user

  PROVIDERS = %w[stripe apple manual].freeze
  STATUSES = %w[active past_due canceled expired].freeze
  INTERVALS = %w[month year].freeze

  validates :provider, presence: true, inclusion: { in: PROVIDERS }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :interval, presence: true, inclusion: { in: INTERVALS }
  validates :external_id, presence: true,
    uniqueness: { scope: :provider, message: "already exists for this provider" }

  scope :active_or_grace, -> { where(status: %w[active past_due]) }
  scope :stripe, -> { where(provider: "stripe") }

  # The most recent subscription that is currently providing access.
  def self.current_for(user)
    user.subscriptions.active_or_grace.order(created_at: :desc).first
  end

  def active?
    status == "active"
  end

  def past_due?
    status == "past_due"
  end

  def canceled?
    status == "canceled"
  end
end
