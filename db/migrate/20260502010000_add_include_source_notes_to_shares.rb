class AddIncludeSourceNotesToShares < ActiveRecord::Migration[7.1]
  def change
    add_column :shares, :include_source_notes, :boolean, default: false, null: false
  end
end
