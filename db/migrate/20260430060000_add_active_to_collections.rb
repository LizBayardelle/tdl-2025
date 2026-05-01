class AddActiveToCollections < ActiveRecord::Migration[7.1]
  def change
    add_column :collections, :active, :boolean, default: true, null: false
    add_index :collections, :active
  end
end
