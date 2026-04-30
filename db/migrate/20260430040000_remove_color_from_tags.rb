class RemoveColorFromTags < ActiveRecord::Migration[7.1]
  def change
    remove_column :tags, :color, :string
  end
end
