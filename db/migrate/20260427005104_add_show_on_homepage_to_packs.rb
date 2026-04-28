class AddShowOnHomepageToPacks < ActiveRecord::Migration[7.2]
  def change
    add_column :packs, :show_on_homepage, :boolean, default: false, null: false
    add_index :packs, :show_on_homepage
  end
end
