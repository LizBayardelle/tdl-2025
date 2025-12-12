class HighlightColor < ApplicationRecord
  belongs_to :user

  validates :label, presence: true
  validates :color_hex, presence: true, format: { with: /\A#[0-9A-F]{6}\z/i }

  default_scope { order(position: :asc) }

  before_create :set_position

  private

  def set_position
    self.position ||= user.highlight_colors.maximum(:position).to_i + 1
  end
end
