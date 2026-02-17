class CollectionItem < ApplicationRecord
  belongs_to :collection
  belongs_to :collectable, polymorphic: true
  belongs_to :added_by, class_name: 'User', optional: true
end
