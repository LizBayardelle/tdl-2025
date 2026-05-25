class CollectionGrouping < ApplicationRecord
  # Per-collection groupings (formerly "tiers"). Each collection owns its own
  # ordered list — names are user-defined. Deleting a grouping nullifies the
  # collection_items pointing to it so those sources fall back to "Unsorted".
  belongs_to :collection
  has_many :collection_items, foreign_key: :grouping_id, dependent: :nullify

  validates :name, presence: true,
                   uniqueness: { scope: :collection_id, case_sensitive: false }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  default_scope -> { order(:position, :id) }
end
