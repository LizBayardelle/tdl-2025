class AddEmailAndUrlToPeople < ActiveRecord::Migration[7.2]
  def change
    add_column :people, :email, :string
    add_column :people, :url, :string
  end
end
