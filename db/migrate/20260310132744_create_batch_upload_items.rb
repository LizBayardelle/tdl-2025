class CreateBatchUploadItems < ActiveRecord::Migration[7.2]
  def change
    create_table :batch_upload_items do |t|
      t.references :batch_upload, null: false, foreign_key: true
      t.references :source, null: true, foreign_key: true
      t.string :status, null: false, default: 'pending'
      t.string :original_filename
      t.bigint :file_size
      t.jsonb :extracted_metadata, default: {}
      t.string :extracted_doi
      t.string :extraction_method
      t.jsonb :detected_authors, default: []
      t.jsonb :detected_concepts, default: []
      t.jsonb :duplicate_candidates, default: []
      t.jsonb :user_decisions, default: {}
      t.text :error_message
      t.integer :retry_count, default: 0

      t.timestamps
    end

    add_index :batch_upload_items, :status
    add_index :batch_upload_items, [:batch_upload_id, :status]
    add_index :batch_upload_items, :extracted_doi
  end
end
