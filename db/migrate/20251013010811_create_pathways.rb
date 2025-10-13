class CreatePathways < ActiveRecord::Migration[7.2]
  def change
    create_table :pathways do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.text :goal # What the learner will achieve by completing this pathway
      t.jsonb :node_sequence, default: [] # Ordered array of node IDs with metadata

      t.timestamps
    end

    add_index :pathways, :name
  end
end
