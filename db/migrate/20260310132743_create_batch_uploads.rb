class CreateBatchUploads < ActiveRecord::Migration[7.2]
  def change
    create_table :batch_uploads do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name
      t.string :status, null: false, default: 'pending'
      t.integer :total_count, default: 0
      t.integer :completed_count, default: 0
      t.integer :failed_count, default: 0
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :batch_uploads, :status
    add_index :batch_uploads, [:user_id, :status]
  end
end
