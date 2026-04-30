class CreateTabletopItems < ActiveRecord::Migration[7.1]
  def change
    create_table :tabletop_items do |t|
      t.references :tabletop, null: false, foreign_key: true
      t.string :kind, null: false # note | source | concept | header | text | arrow
      # Polymorphic ref for note/source/concept items (nil for header/text/arrow).
      t.references :item, polymorphic: true

      # World-space layout
      t.float :x, null: false, default: 0.0
      t.float :y, null: false, default: 0.0
      t.float :width
      t.float :height
      t.float :rotation, null: false, default: 0.0
      t.integer :z_index, null: false, default: 0

      # Decoration content (header / text)
      t.text :body

      # Arrow endpoints (relative to its own x,y origin or absolute world coords)
      t.float :start_x
      t.float :start_y
      t.float :end_x
      t.float :end_y

      # Optional accent
      t.string :color

      t.timestamps
    end

    add_index :tabletop_items, [:tabletop_id, :z_index]
  end
end
