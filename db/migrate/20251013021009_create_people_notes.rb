class CreatePeopleNotes < ActiveRecord::Migration[7.2]
  def change
    create_table :people_notes do |t|
      t.references :person, null: false, foreign_key: true
      t.references :note, null: false, foreign_key: true

      t.string :rel_type # mentioned, inspired_by, case_subject, critiqued_by
      t.text :context
      t.integer :prominence # 1-5 how central is this person to the note

      t.timestamps
    end

    add_index :people_notes, [:person_id, :note_id]
    add_index :people_notes, :rel_type
  end
end
