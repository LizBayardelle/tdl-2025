class CreateConceptDefinitions < ActiveRecord::Migration[7.2]
  def change
    create_table :concept_definitions do |t|
      t.string :label, null: false
      t.text :aliases, default: [], array: true
      t.string :concept_type
      t.text :summary
      t.text :description
      t.text :location
      t.text :examples
      t.text :etymology
      t.text :school_of_thought
      t.text :history
      t.text :controversy
      t.text :clinical_relevance
      t.text :misconceptions
      t.text :mnemonic
      t.text :developmental_notes
      t.text :measurement_notes
      t.jsonb :external_refs, default: []
      t.text :attribution
      t.references :pack, foreign_key: true
      t.string :pack_version
      t.timestamps
    end

    add_index :concept_definitions, :concept_type
    add_index :concept_definitions, :label

    create_table :concept_definition_domains, id: false do |t|
      t.references :concept_definition, null: false, foreign_key: true
      t.references :domain, null: false, foreign_key: true
    end

    add_index :concept_definition_domains, [:concept_definition_id, :domain_id], unique: true, name: "idx_concept_def_domains_unique"
  end
end
