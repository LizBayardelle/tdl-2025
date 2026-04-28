# Markers are user-controlled flags on a source.  Examples: "to read",
# "needs pdf", "core", "outdated", "methods reference", "for thesis".
# Lets researchers organize without committing to a fixed taxonomy.
# Stored as a text array so a single source can carry multiple markers.
class AddMarkersToSources < ActiveRecord::Migration[7.1]
  def change
    add_column :sources, :markers, :text, array: true, default: [], null: false
    add_index :sources, :markers, using: 'gin'
  end
end
