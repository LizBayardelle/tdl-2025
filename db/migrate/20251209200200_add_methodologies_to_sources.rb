class AddMethodologiesToSources < ActiveRecord::Migration[7.2]
  def change
    add_column :sources, :methodologies, :json
  end
end
