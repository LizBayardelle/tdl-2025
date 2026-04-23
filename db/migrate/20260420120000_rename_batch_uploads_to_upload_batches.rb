class RenameBatchUploadsToUploadBatches < ActiveRecord::Migration[7.2]
  def change
    rename_table :batch_uploads, :upload_batches
    rename_table :batch_upload_items, :upload_batch_items
    rename_column :upload_batch_items, :batch_upload_id, :upload_batch_id
  end
end
