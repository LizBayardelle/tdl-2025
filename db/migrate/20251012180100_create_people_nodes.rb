class CreatePeopleNodes < ActiveRecord::Migration[7.2]
  def change
    create_table :people_nodes do |t|
      t.references :person, null: false, foreign_key: true
      t.references :node, null: false, foreign_key: true

      t.string :rel_type # authored, uses, studies, exemplifies, influenced
      t.text :notes
      t.integer :strength # 1-5 rating of connection strength
      t.decimal :confidence # 0.0-1.0 confidence in this relationship

      t.timestamps
    end

    add_index :people_nodes, [:person_id, :node_id], unique: true
    add_index :people_nodes, :rel_type
  end
end
