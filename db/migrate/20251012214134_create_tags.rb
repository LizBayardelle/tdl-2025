class CreateTags < ActiveRecord::Migration[7.2]
  def change
    create_table :tags do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :color # hex color for visual identification

      t.timestamps
    end

    add_index :tags, [:user_id, :slug], unique: true
    add_index :tags, :name
  end
end
