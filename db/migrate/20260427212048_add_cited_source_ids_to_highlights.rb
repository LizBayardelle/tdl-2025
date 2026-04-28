class AddCitedSourceIdsToHighlights < ActiveRecord::Migration[7.2]
  def change
    add_column :highlights, :cited_source_ids, :jsonb
  end
end
