class CreateAllowedDomains < ActiveRecord::Migration[7.2]
  def change
    create_table :allowed_domains do |t|
      t.string :domain, null: false
      t.string :category
      t.boolean :active, null: false, default: true
      t.text :notes
      t.references :added_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :allowed_domains, :domain, unique: true
    add_index :allowed_domains, :active
    add_index :allowed_domains, :category
  end
end
