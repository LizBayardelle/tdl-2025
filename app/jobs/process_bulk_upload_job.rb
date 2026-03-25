# Orchestrator job that enqueues per-item processing jobs
class ProcessBulkUploadJob < ApplicationJob
  queue_as :default

  def perform(batch_upload_id)
    batch_upload = BatchUpload.find_by(id: batch_upload_id)
    return unless batch_upload

    Rails.logger.info "Starting bulk upload processing for batch #{batch_upload_id}"

    # Enqueue processing for each pending item
    batch_upload.batch_upload_items.where(status: :pending).find_each do |item|
      item.start_extraction!
    end

    Rails.logger.info "Enqueued #{batch_upload.batch_upload_items.count} items for processing"
  end
end
