class RenameNodesToConcepts < ActiveRecord::Migration[7.2]
  def change
    rename_table :nodes, :concepts

    # Rename foreign key columns in related tables
    rename_column :node_sources, :node_id, :concept_id
    rename_column :people_nodes, :node_id, :concept_id
    rename_column :notes, :node_id, :concept_id
    rename_column :edges, :src_id, :src_concept_id
    rename_column :edges, :dst_id, :dst_concept_id

    # Rename join tables
    rename_table :node_sources, :concept_sources
    rename_table :people_nodes, :people_concepts
  end
end
