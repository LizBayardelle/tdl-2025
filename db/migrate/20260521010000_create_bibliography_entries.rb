class CreateBibliographyEntries < ActiveRecord::Migration[7.2]
  def change
    create_table :bibliography_entries do |t|
      t.references :collection, null: false, foreign_key: true
      t.references :source, null: false, foreign_key: true
      t.text :internal_annotation
      t.text :formal_annotation
      t.timestamps
    end

    # One annotation entry per source within a given collection's bibliography.
    add_index :bibliography_entries, [:collection_id, :source_id],
              unique: true, name: "index_bibliography_entries_on_collection_and_source"
  end
end
