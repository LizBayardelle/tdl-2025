class AddSelectedLinksToConceptGenerations < ActiveRecord::Migration[7.2]
  def change
    add_column :concept_generations, :selected_links, :jsonb, default: []
    add_column :concept_generations, :enrich_completed_at, :datetime
  end
end
