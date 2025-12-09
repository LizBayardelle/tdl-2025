class CreateAuthors < ActiveRecord::Migration[7.0]
  def change
    create_table :authors do |t|
      t.string :last_name
      t.string :first_name
      t.string :middle_initial
      t.string :full_name
      t.string :orcid
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end

    add_index :authors, :full_name
    add_index :authors, :orcid, unique: true, where: "orcid IS NOT NULL"
  end
end
