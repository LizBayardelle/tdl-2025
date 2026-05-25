class CollectionItem < ApplicationRecord
  belongs_to :collection
  belongs_to :collectable, polymorphic: true
  belongs_to :added_by, class_name: 'User', optional: true
  belongs_to :grouping, class_name: 'CollectionGrouping', optional: true

  validate :grouping_belongs_to_same_collection

  private

  # Guard against cross-collection grouping assignments — a grouping is
  # scoped to its parent collection and shouldn't be reachable from a
  # collection_item in another collection.
  def grouping_belongs_to_same_collection
    return if grouping_id.nil?
    return if grouping&.collection_id == collection_id
    errors.add(:grouping_id, "must belong to this collection")
  end
end
