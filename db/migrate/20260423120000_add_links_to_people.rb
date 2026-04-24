class AddLinksToPeople < ActiveRecord::Migration[7.2]
  def change
    add_column :people, :links, :jsonb, default: []
    add_column :people, :enriched_at, :datetime
  end
end
