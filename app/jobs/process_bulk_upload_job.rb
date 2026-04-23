# Orchestrator job that enqueues per-item processing jobs
class ProcessBulkUploadJob < ApplicationJob
  queue_as :default

  def perform(upload_batch_id)
    upload_batch = UploadBatch.find_by(id: upload_batch_id)
    return unless upload_batch

    Rails.logger.info "Starting bulk upload processing for batch #{upload_batch_id}"

    upload_batch.upload_batch_items.where(status: :pending).find_each do |item|
      item.start_extraction!
    end

    Rails.logger.info "Enqueued #{upload_batch.upload_batch_items.count} items for processing"
  end
end
