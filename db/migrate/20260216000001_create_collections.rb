class CreateCollections < ActiveRecord::Migration[7.2]
  def change
    create_table :collections do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.string :slug, null: false
      t.timestamps

      t.index [:user_id, :slug], unique: true
    end
  end
end
