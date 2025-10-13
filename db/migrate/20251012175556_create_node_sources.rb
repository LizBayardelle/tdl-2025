class CreateNodeSources < ActiveRecord::Migration[7.2]
  def change
    create_table :node_sources do |t|
      t.references :node, null: false, foreign_key: true
      t.references :source, null: false, foreign_key: true

      t.string :role # primary, recommended, critical_review, protocol
      t.text :notes

      t.timestamps
    end

    add_index :node_sources, [:node_id, :source_id], unique: true
    add_index :node_sources, :role
  end
end
