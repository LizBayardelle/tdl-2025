class Linking < ApplicationRecord
  belongs_to :link
  belongs_to :linkable, polymorphic: true

  validates :link_id, uniqueness: { scope: [:linkable_type, :linkable_id] }
end
