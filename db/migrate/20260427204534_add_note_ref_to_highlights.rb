class AddNoteRefToHighlights < ActiveRecord::Migration[7.2]
  def change
    add_reference :highlights, :note, null: true, foreign_key: true
    change_column_null :highlights, :color_hex, true
  end
end
