class AddAnchorsToTabletopItems < ActiveRecord::Migration[7.1]
  def change
    add_column :tabletop_items, :start_anchor_id, :integer
    add_column :tabletop_items, :end_anchor_id,   :integer
    add_index  :tabletop_items, :start_anchor_id
    add_index  :tabletop_items, :end_anchor_id
  end
end
