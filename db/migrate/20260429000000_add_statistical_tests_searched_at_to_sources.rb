class AddStatisticalTestsSearchedAtToSources < ActiveRecord::Migration[7.1]
  def change
    add_column :sources, :statistical_tests_searched_at, :datetime
  end
end
