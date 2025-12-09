class CreateSourceAuthors < ActiveRecord::Migration[7.0]
  def change
    create_table :source_authors do |t|
      t.references :source, null: false, foreign_key: true
      t.references :author, null: false, foreign_key: true
      t.integer :position, null: false

      t.timestamps
    end

    add_index :source_authors, [:source_id, :author_id], unique: true
    add_index :source_authors, [:source_id, :position]
  end
end
