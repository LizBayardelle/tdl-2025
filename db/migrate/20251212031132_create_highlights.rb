class CreateHighlights < ActiveRecord::Migration[7.2]
  def change
    create_table :highlights do |t|
      t.references :user, null: false, foreign_key: true
      t.references :source, null: false, foreign_key: true
      t.integer :page_number
      t.text :text_content
      t.string :color_hex
      t.jsonb :bounds

      t.timestamps
    end
  end
end
