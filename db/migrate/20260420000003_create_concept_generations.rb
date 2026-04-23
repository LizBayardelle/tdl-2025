class CreateConceptGenerations < ActiveRecord::Migration[7.2]
  def change
    create_table :concept_generations do |t|
      t.references :concept_generation_batch, null: false, foreign_key: true, index: { name: 'idx_concept_generations_on_batch' }
      t.string :concept_name, null: false
      t.string :concept_type
      t.string :target_mode, null: false, default: 'create_new'
      t.references :target_concept_definition, foreign_key: { to_table: :concept_definitions }
      t.string :status, null: false, default: 'pending'

      t.text :label
      t.text :aliases, array: true, default: []
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

      t.jsonb :citations, default: {}
      t.jsonb :web_search_sources, default: []
      t.jsonb :fact_check_notes, default: []
      t.jsonb :stage_errors, default: {}
      t.jsonb :token_usage, default: {}
      t.jsonb :previous_snapshot, default: {}

      t.string :generate_job_id
      t.string :fact_check_job_id
      t.string :enrich_job_id

      t.references :approved_concept_definition, foreign_key: { to_table: :concept_definitions }
      t.datetime :approved_at
      t.text :rejected_reason

      t.timestamps
    end

    add_index :concept_generations, :status
    add_index :concept_generations, [:concept_generation_batch_id, :status], name: 'idx_concept_generations_on_batch_status'
  end
end
