class CreateNotes < ActiveRecord::Migration[7.2]
  def change
    create_table :notes do |t|
      t.references :user, null: false, foreign_key: true
      t.references :node, foreign_key: true

      # Content
      t.text :body, null: false
      t.string :note_type # reflection, question, insight, critique, application, synthesis

      # Context
      t.text :context # What prompted this note
      t.text :tags, array: true, default: []

      # Metadata
      t.boolean :pinned, default: false
      t.date :noted_on

      t.timestamps
    end

    add_index :notes, :note_type
    add_index :notes, :pinned
    add_index :notes, :noted_on
  end
end
