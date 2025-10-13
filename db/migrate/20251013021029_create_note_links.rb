class CreateNoteLinks < ActiveRecord::Migration[7.2]
  def change
    create_table :note_links do |t|
      t.references :note, null: false, foreign_key: true
      t.references :linked, polymorphic: true, null: false

      t.string :link_type # references, elaborates, contrasts, synthesizes
      t.text :context # Brief explanation of the connection
      t.integer :relevance # 1-5 how relevant is this link

      t.timestamps
    end

    add_index :note_links, [:note_id, :linked_type, :linked_id]
    add_index :note_links, [:linked_type, :linked_id]
    add_index :note_links, :link_type
  end
end
