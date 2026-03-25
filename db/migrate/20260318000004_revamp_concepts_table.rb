class RevampConceptsTable < ActiveRecord::Migration[7.2]
  def change
    # Remove old columns
    remove_index :concepts, :node_type
    remove_index :concepts, :level_status
    remove_column :concepts, :node_type, :string
    remove_column :concepts, :summary_top, :text
    remove_column :concepts, :summary_mid, :text
    remove_column :concepts, :summary_deep, :text
    remove_column :concepts, :level_status, :string

    # Add new columns
    add_reference :concepts, :definition, foreign_key: { to_table: :concept_definitions }
    add_column :concepts, :concept_type, :string
    add_column :concepts, :aliases, :text, default: [], array: true
    add_column :concepts, :summary, :text
    add_column :concepts, :description, :text
    add_column :concepts, :location, :text
    add_column :concepts, :examples, :text
    add_column :concepts, :etymology, :text
    add_column :concepts, :school_of_thought, :text
    add_column :concepts, :history, :text
    add_column :concepts, :controversy, :text
    add_column :concepts, :clinical_relevance, :text
    add_column :concepts, :misconceptions, :text
    add_column :concepts, :mnemonic, :text
    add_column :concepts, :developmental_notes, :text
    add_column :concepts, :measurement_notes, :text
    add_column :concepts, :external_refs, :jsonb, default: []

    add_index :concepts, :concept_type

    # Create concept_domains join table
    create_table :concept_domains, id: false do |t|
      t.references :concept, null: false, foreign_key: true
      t.references :domain, null: false, foreign_key: true
    end

    add_index :concept_domains, [:concept_id, :domain_id], unique: true
  end
end
