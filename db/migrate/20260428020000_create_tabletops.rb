class CreateTabletops < ActiveRecord::Migration[7.1]
  def change
    create_table :tabletops do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.float :view_x, default: 0.0
      t.float :view_y, default: 0.0
      t.float :view_zoom, default: 1.0
      t.datetime :last_opened_at
      t.timestamps
    end

    add_index :tabletops, [:user_id, :last_opened_at]
  end
end
