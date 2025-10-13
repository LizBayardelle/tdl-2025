class CreateEdges < ActiveRecord::Migration[7.2]
  def change
    create_table :edges do |t|
      t.references :user, null: false, foreign_key: true
      t.references :src, null: false, foreign_key: { to_table: :nodes }
      t.references :dst, null: false, foreign_key: { to_table: :nodes }

      # Relationship metadata
      t.string :rel_type, null: false # adjacent, contrasts_with, integrates_with
      t.integer :strength # 1-5, degree of similarity or contrast
      t.text :description # Narrative explanation of the relationship
      t.text :tags, array: true, default: []
      t.date :last_reviewed_on

      t.timestamps
    end

    add_index :edges, [:src_id, :dst_id], unique: true
    add_index :edges, :rel_type
    add_index :edges, :strength
  end
end
