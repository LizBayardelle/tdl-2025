class AddStagedToTabletopItems < ActiveRecord::Migration[7.1]
  def change
    add_column :tabletop_items, :staged, :boolean, default: false, null: false
    add_index  :tabletop_items, [:tabletop_id, :staged]
  end
end
