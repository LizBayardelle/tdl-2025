class AddAttributionToConceptGenerations < ActiveRecord::Migration[7.2]
  def change
    add_column :concept_generations, :attribution, :text
  end
end
