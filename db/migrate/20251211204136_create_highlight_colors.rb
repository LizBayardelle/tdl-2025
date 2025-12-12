class CreateHighlightColors < ActiveRecord::Migration[7.2]
  def change
    create_table :highlight_colors do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label
      t.string :color_hex
      t.integer :position

      t.timestamps
    end
  end
end
