class AddAnchorSidesToTabletopItems < ActiveRecord::Migration[7.1]
  def change
    add_column :tabletop_items, :start_anchor_side, :string
    add_column :tabletop_items, :end_anchor_side,   :string
  end
end
