class AddOrcidToPeople < ActiveRecord::Migration[7.2]
  def change
    add_column :people, :orcid, :string
    add_index :people, :orcid
  end
end
