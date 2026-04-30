class PassageInsightUnlock < ApplicationRecord
  belongs_to :user
  belongs_to :source

  scope :since, ->(time) { where('granted_at >= ?', time) }
  scope :this_month, -> { since(Time.current.beginning_of_month) }

  validates :user_id, uniqueness: { scope: :source_id }
end
