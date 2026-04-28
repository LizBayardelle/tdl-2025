class Highlight < ApplicationRecord
  belongs_to :user
  belongs_to :source
  belongs_to :note, optional: true

  validates :page_number, presence: true
  validates :text_content, presence: true
  validates :color_hex, format: { with: /\A#[0-9A-F]{6}\z/i }, allow_blank: true

  scope :for_source, ->(source_id) { where(source_id: source_id) }
  scope :for_page, ->(page_number) { where(page_number: page_number) }
end
