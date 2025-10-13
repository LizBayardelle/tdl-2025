class UpdateConceptRelationshipsSchema < ActiveRecord::Migration[7.2]
  def change
    # Remove the strength column
    remove_column :connections, :strength, :integer

    # Add optional relationship_label for custom descriptions
    add_column :connections, :relationship_label, :string

    # Add index for querying by rel_type (already exists as relationship_type field)
    # rel_type already exists and has an index, so we're good there
  end
end
