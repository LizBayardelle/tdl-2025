class RenameEdgesToConnections < ActiveRecord::Migration[7.2]
  def change
    rename_table :edges, :connections
  end
end
