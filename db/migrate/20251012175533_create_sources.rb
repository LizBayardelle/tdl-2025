class CreateSources < ActiveRecord::Migration[7.2]
  def change
    create_table :sources do |t|
      t.references :user, null: false, foreign_key: true

      # Core identification
      t.string :title, null: false
      t.string :authors
      t.integer :year
      t.string :kind # manual, textbook, RCT, meta_analysis, guideline, video_demo
      t.string :publisher_or_venue
      t.string :doi_or_url
      t.text :citation
      t.text :summary # 3-5 line key findings

      # Organization
      t.text :tags, array: true, default: []

      t.timestamps
    end

    add_index :sources, :kind
    add_index :sources, :year
  end
end
