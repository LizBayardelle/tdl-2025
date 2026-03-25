# Daily cleanup of abandoned batch uploads older than 7 days
class CleanupStaleUploadsJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "Running cleanup of stale batch uploads..."

    # Find stale uploads (pending or processing for more than 7 days)
    stale_uploads = BatchUpload.stale

    count = stale_uploads.count
    Rails.logger.info "Found #{count} stale batch uploads to clean up"

    stale_uploads.find_each do |batch|
      Rails.logger.info "Cleaning up batch upload #{batch.id} (created: #{batch.created_at})"

      # Delete all items and their attachments
      batch.batch_upload_items.each do |item|
        item.pdf.purge if item.pdf.attached?
      end

      # Delete the batch (cascades to items)
      batch.destroy
    end

    Rails.logger.info "Cleanup complete. Removed #{count} stale batch uploads."
  end
end
