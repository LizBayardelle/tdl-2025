class CreateSourceStatisticalTests < ActiveRecord::Migration[7.1]
  def change
    create_table :source_statistical_tests do |t|
      t.references :source, null: false, foreign_key: true
      t.references :statistical_test, null: false, foreign_key: true
      t.float :confidence
      t.boolean :detected_automatically, null: false, default: false
      t.text :notes

      t.timestamps
    end

    add_index :source_statistical_tests, [:source_id, :statistical_test_id], unique: true, name: 'index_source_stat_tests_on_pair'
  end
end
