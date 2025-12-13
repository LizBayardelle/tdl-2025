class AddPageNumberToNotes < ActiveRecord::Migration[7.2]
  def change
    add_column :notes, :page_number, :integer
  end
end
