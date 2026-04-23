# Daily cleanup of abandoned batch uploads older than 7 days
class CleanupStaleUploadsJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "Running cleanup of stale upload batches..."

    stale_uploads = UploadBatch.stale

    count = stale_uploads.count
    Rails.logger.info "Found #{count} stale upload batches to clean up"

    stale_uploads.find_each do |batch|
      Rails.logger.info "Cleaning up upload batch #{batch.id} (created: #{batch.created_at})"

      batch.upload_batch_items.each do |item|
        item.pdf.purge if item.pdf.attached?
      end

      batch.destroy
    end

    Rails.logger.info "Cleanup complete. Removed #{count} stale upload batches."
  end
end
