class CreateCollectionItems < ActiveRecord::Migration[7.2]
  def change
    create_table :collection_items do |t|
      t.references :collection, null: false, foreign_key: true
      t.string :collectable_type, null: false
      t.bigint :collectable_id, null: false
      t.datetime :added_at, default: -> { 'CURRENT_TIMESTAMP' }
      t.references :added_by, foreign_key: { to_table: :users }
      t.timestamps

      t.index [:collection_id, :collectable_type, :collectable_id], unique: true, name: 'idx_collection_items_unique'
      t.index [:collectable_type, :collectable_id]
    end
  end
end
