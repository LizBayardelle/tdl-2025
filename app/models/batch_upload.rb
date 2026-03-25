class BatchUpload < ApplicationRecord
  belongs_to :user
  has_many :batch_upload_items, dependent: :destroy

  # Status enum
  enum :status, {
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed'
  }, prefix: true

  # Validations
  validates :user_id, presence: true
  validates :status, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :active, -> { where(status: [:pending, :processing]) }
  scope :stale, -> { where('created_at < ? AND status IN (?)', 7.days.ago, ['pending', 'processing']) }

  # Callbacks
  after_create :set_initial_counts

  # Start processing all items
  def start_processing!
    return unless status_pending?

    update!(status: :processing, started_at: Time.current)
    ProcessBulkUploadJob.perform_later(id)
  end

  # Update counts from items
  def update_counts!
    items = batch_upload_items
    update!(
      total_count: items.count,
      completed_count: items.where(status: [:approved, :created]).count,
      failed_count: items.where(status: :failed).count
    )
    check_completion!
  end

  # Check if all items are processed
  def check_completion!
    return unless status_processing?

    items = batch_upload_items
    pending_items = items.where(status: [:pending, :uploading, :extracting])

    if pending_items.empty?
      # All items have been processed
      if items.where(status: :failed).count == items.count
        update!(status: :failed, completed_at: Time.current)
      else
        update!(status: :completed, completed_at: Time.current)
      end
    end
  end

  # Progress percentage
  def progress_percentage
    return 0 if total_count.zero?

    processed = batch_upload_items.where.not(status: [:pending, :uploading, :extracting]).count
    (processed.to_f / total_count * 100).round
  end

  # Summary stats
  def stats
    items = batch_upload_items.group(:status).count
    {
      total: total_count,
      pending: items['pending'] || 0,
      extracting: (items['uploading'] || 0) + (items['extracting'] || 0),
      extracted: items['extracted'] || 0,
      review_needed: items['review_needed'] || 0,
      approved: items['approved'] || 0,
      created: items['created'] || 0,
      failed: items['failed'] || 0
    }
  end

  private

  def set_initial_counts
    update_columns(total_count: batch_upload_items.count)
  end
end
