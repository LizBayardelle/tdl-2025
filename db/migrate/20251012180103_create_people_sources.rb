class CreatePeopleSources < ActiveRecord::Migration[7.2]
  def change
    create_table :people_sources do |t|
      t.references :person, null: false, foreign_key: true
      t.references :source, null: false, foreign_key: true

      t.string :role # author, editor, critic, subject_of, translator
      t.text :notes
      t.decimal :confidence # 0.0-1.0 confidence in attribution
      t.text :tags, array: true, default: []
      t.date :last_reviewed_on

      t.timestamps
    end

    add_index :people_sources, [:person_id, :source_id], unique: true
    add_index :people_sources, :role
  end
end
