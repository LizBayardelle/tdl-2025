class CreatePacks < ActiveRecord::Migration[7.2]
  def change
    create_table :packs do |t|
      t.string :name, null: false
      t.text :description
      t.integer :price_cents, null: false, default: 0
      t.string :currency, default: "usd"
      t.integer :concept_count, default: 0
      t.boolean :published, default: false
      t.timestamps
    end

    create_table :user_packs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :pack, null: false, foreign_key: true
      t.datetime :purchased_at
      t.timestamps
    end

    add_index :user_packs, [:user_id, :pack_id], unique: true
  end
end
