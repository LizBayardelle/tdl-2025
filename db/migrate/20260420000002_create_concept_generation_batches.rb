class CreateConceptGenerationBatches < ActiveRecord::Migration[7.2]
  def change
    create_table :concept_generation_batches do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name
      t.string :status, null: false, default: 'pending'
      t.integer :total_count, default: 0
      t.integer :generated_count, default: 0
      t.integer :approved_count, default: 0
      t.integer :rejected_count, default: 0
      t.integer :failed_count, default: 0
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :concept_generation_batches, :status
    add_index :concept_generation_batches, [:user_id, :status]
  end
end
