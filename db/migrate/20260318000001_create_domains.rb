class CreateDomains < ActiveRecord::Migration[7.2]
  def change
    create_table :domains do |t|
      t.string :name, null: false
      t.bigint :parent_id
      t.boolean :is_default, default: false
      t.boolean :system_generated, default: false
      t.timestamps
    end

    add_index :domains, :name, unique: true
    add_index :domains, :parent_id
    add_foreign_key :domains, :domains, column: :parent_id
  end
end
