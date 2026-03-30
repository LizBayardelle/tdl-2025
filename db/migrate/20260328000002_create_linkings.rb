class CreateLinkings < ActiveRecord::Migration[7.2]
  def change
    create_table :linkings do |t|
      t.references :link, null: false, foreign_key: true
      t.references :linkable, polymorphic: true, null: false

      t.timestamps
    end

    add_index :linkings, [:linkable_type, :linkable_id, :link_id], unique: true, name: 'index_linkings_uniqueness'
  end
end
