class CreateConceptDisambiguations < ActiveRecord::Migration[7.2]
  def change
    create_table :concept_disambiguations do |t|
      t.references :user, null: false, foreign_key: true
      t.bigint :concept_a_id, null: false
      t.bigint :concept_b_id, null: false
      t.timestamps
    end

    add_foreign_key :concept_disambiguations, :concepts, column: :concept_a_id, on_delete: :cascade
    add_foreign_key :concept_disambiguations, :concepts, column: :concept_b_id, on_delete: :cascade

    add_index :concept_disambiguations, [:user_id, :concept_a_id, :concept_b_id],
              unique: true, name: "index_concept_disambiguations_unique"
    add_index :concept_disambiguations, :concept_a_id
    add_index :concept_disambiguations, :concept_b_id

    # Enforce canonical ordering so we never store both (A,B) and (B,A).
    execute <<~SQL
      ALTER TABLE concept_disambiguations
      ADD CONSTRAINT concept_disambiguations_ordered_pair_check
      CHECK (concept_a_id < concept_b_id)
    SQL
  end
end
