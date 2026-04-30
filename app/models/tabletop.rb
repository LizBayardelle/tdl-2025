class Tabletop < ApplicationRecord
  include Shareable
  include Taggable

  belongs_to :user
  has_many :tabletop_items, -> { order(:z_index, :id) }, dependent: :destroy

  validates :name, presence: true

  scope :recent, -> { order(Arel.sql("COALESCE(last_opened_at, updated_at) DESC")) }

  def items_count
    tabletop_items.size
  end

  def notes_count
    tabletop_items.where(kind: 'note').size
  end

  def touch_opened!
    update_column(:last_opened_at, Time.current)
  end
end
