class AddSourceToNotes < ActiveRecord::Migration[7.0]
  def change
    add_reference :notes, :source, foreign_key: true, null: true
  end
end
