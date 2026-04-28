class AddQuoteFieldsToNotes < ActiveRecord::Migration[7.2]
  def change
    add_column :notes, :quote_text, :text
    add_column :notes, :quote_bounds, :jsonb
  end
end
