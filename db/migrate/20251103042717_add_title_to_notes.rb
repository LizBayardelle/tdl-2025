class AddTitleToNotes < ActiveRecord::Migration[7.2]
  def change
    add_column :notes, :title, :string
  end
end
