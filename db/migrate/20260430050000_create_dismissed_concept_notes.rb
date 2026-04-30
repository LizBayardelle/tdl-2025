class CreateDismissedConceptNotes < ActiveRecord::Migration[7.1]
  def change
    create_table :dismissed_concept_notes do |t|
      t.references :concept, null: false, foreign_key: { on_delete: :cascade }
      t.references :note,    null: false, foreign_key: { on_delete: :cascade }
      t.datetime :dismissed_at, null: false
      t.timestamps
    end

    # One dismissal per (concept, note).  Re-dismissing is a no-op.
    add_index :dismissed_concept_notes, [:concept_id, :note_id], unique: true
  end
end
