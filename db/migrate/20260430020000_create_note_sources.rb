class CreateNoteSources < ActiveRecord::Migration[7.1]
  def up
    create_table :note_sources do |t|
      t.references :note,   null: false, foreign_key: { on_delete: :cascade }
      t.references :source, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :note_sources, [:note_id, :source_id], unique: true

    # Backfill: every existing notes.source_id becomes a note_sources row.
    # We keep notes.source_id as the "primary" source (the one carrying the
    # highlight when the note quotes a passage); the join is the canonical
    # multi-attachment list.
    execute <<~SQL
      INSERT INTO note_sources (note_id, source_id, created_at, updated_at)
      SELECT id, source_id, COALESCE(updated_at, NOW()), COALESCE(updated_at, NOW())
      FROM notes
      WHERE source_id IS NOT NULL
      ON CONFLICT (note_id, source_id) DO NOTHING;
    SQL
  end

  def down
    drop_table :note_sources
  end
end
