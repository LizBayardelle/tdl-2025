class CreateLinks < ActiveRecord::Migration[7.2]
  def change
    create_table :links do |t|
      t.string :name, null: false
      t.string :url, null: false
      t.text :description

      t.timestamps
    end
  end
end
