class CreateConceptNotes < ActiveRecord::Migration[7.2]
  def change
    create_table :concept_notes do |t|
      t.references :note, null: false, foreign_key: true
      t.references :concept, null: false, foreign_key: true

      t.timestamps
    end
  end
end
