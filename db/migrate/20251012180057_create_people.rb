class CreatePeople < ActiveRecord::Migration[7.2]
  def change
    create_table :people do |t|
      t.references :user, null: false, foreign_key: true

      # Core identification
      t.string :full_name, null: false
      t.text :aka, array: true, default: [] # Also known as (aliases, nicknames)
      t.string :role # theorist, clinician, peer, client
      t.text :summary

      # Flexible attributes for additional info
      t.jsonb :attrs, default: {}

      t.timestamps
    end

    add_index :people, :role
    add_index :people, :full_name
  end
end
