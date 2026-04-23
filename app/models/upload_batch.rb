class UploadBatch < ApplicationRecord
  belongs_to :user
  has_many :upload_batch_items, dependent: :destroy

  enum :status, {
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed'
  }, prefix: true

  validates :user_id, presence: true
  validates :status, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :active, -> { where(status: [:pending, :processing]) }
  scope :stale, -> { where('created_at < ? AND status IN (?)', 7.days.ago, ['pending', 'processing']) }

  after_create :set_initial_counts

  def start_processing!
    return unless status_pending?

    update!(status: :processing, started_at: Time.current)
    ProcessBulkUploadJob.perform_later(id)
  end

  def update_counts!
    items = upload_batch_items
    update!(
      total_count: items.count,
      completed_count: items.where(status: [:approved, :created]).count,
      failed_count: items.where(status: :failed).count
    )
    check_completion!
  end

  def check_completion!
    return unless status_processing?

    items = upload_batch_items
    pending_items = items.where(status: [:pending, :uploading, :extracting])

    if pending_items.empty?
      if items.where(status: :failed).count == items.count
        update!(status: :failed, completed_at: Time.current)
      else
        update!(status: :completed, completed_at: Time.current)
      end
    end
  end

  def progress_percentage
    return 0 if total_count.zero?

    processed = upload_batch_items.where.not(status: [:pending, :uploading, :extracting]).count
    (processed.to_f / total_count * 100).round
  end

  def stats
    items = upload_batch_items.group(:status).count
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
    update_columns(total_count: upload_batch_items.count)
  end
end
