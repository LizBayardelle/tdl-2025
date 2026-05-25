class AddTierToCollectionItems < ActiveRecord::Migration[7.2]
  def change
    add_column :collection_items, :tier, :string
    add_index  :collection_items, [:collection_id, :tier]
  end
end
