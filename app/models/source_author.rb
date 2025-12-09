class SourceAuthor < ApplicationRecord
  belongs_to :source
  belongs_to :author

  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :author_id, uniqueness: { scope: :source_id }
end
