class BatchUploadItem < ApplicationRecord
  belongs_to :batch_upload
  belongs_to :source, optional: true
  has_one_attached :pdf

  # Status flow: pending → uploading → extracting → extracted → review_needed → approved → created
  #                                                         ↘ failed (with error_message)
  #                                                         ↘ skipped (user chose to skip)
  enum :status, {
    pending: 'pending',
    uploading: 'uploading',
    extracting: 'extracting',
    extracted: 'extracted',
    review_needed: 'review_needed',
    approved: 'approved',
    created: 'created',
    failed: 'failed',
    skipped: 'skipped'
  }, prefix: true

  # Validations
  validates :batch_upload_id, presence: true
  validates :status, presence: true

  # Scopes
  scope :pending_processing, -> { where(status: [:pending, :uploading, :extracting]) }
  scope :needs_review, -> { where(status: :review_needed) }
  scope :ready_for_approval, -> { where(status: [:extracted, :review_needed]) }
  scope :completed, -> { where(status: [:approved, :created, :skipped]) }
  scope :skipped, -> { where(status: :skipped) }
  scope :failed, -> { where(status: :failed) }

  # Delegate user to batch_upload
  delegate :user, to: :batch_upload

  # After status change, update parent batch counts
  after_save :update_batch_counts, if: :saved_change_to_status?

  # Start extraction process
  def start_extraction!
    return unless status_pending?

    update!(status: :extracting)
    ProcessBulkUploadItemJob.perform_later(id)
  end

  # Mark as needing review
  def needs_review!(reason = nil)
    update!(
      status: :review_needed,
      user_decisions: user_decisions.merge('review_reason' => reason)
    )
  end

  # Mark as extracted (auto-approved if no ambiguity)
  def mark_extracted!(metadata: {}, doi: nil, method: nil, authors: [], concepts: [], duplicates: [])
    needs_review = authors.any? { |a| a['ambiguous'] } ||
                   concepts.any? { |c| c['ambiguous'] } ||
                   duplicates.any?

    update!(
      status: needs_review ? :review_needed : :extracted,
      extracted_metadata: metadata,
      extracted_doi: doi,
      extraction_method: method,
      detected_authors: authors,
      detected_concepts: concepts,
      duplicate_candidates: duplicates
    )
  end

  # Mark as failed
  def mark_failed!(message)
    increment!(:retry_count)
    update!(
      status: :failed,
      error_message: message
    )
  end

  # Approve for source creation
  def approve!(decisions = {})
    return unless status_extracted? || status_review_needed?

    update!(
      status: :approved,
      user_decisions: decisions
    )
    CreateSourceFromUploadJob.perform_later(id)
  end

  # Retry failed extraction
  def retry!
    return unless status_failed?

    update!(
      status: :pending,
      error_message: nil
    )
    start_extraction!
  end

  # Skip this item (user chose not to import)
  def skip!
    return if status_approved? || status_created? || status_skipped?

    update!(status: :skipped)
    # Purge the PDF since we're not importing it
    pdf.purge if pdf.attached?
  end

  # Build metadata for display
  def display_metadata
    extracted_metadata.merge(
      'original_filename' => original_filename,
      'extracted_doi' => extracted_doi,
      'extraction_method' => extraction_method
    )
  end

  # Check if item has potential duplicates
  def has_duplicates?
    duplicate_candidates.present? && duplicate_candidates.any?
  end

  # Check if item needs author review
  def needs_author_review?
    detected_authors.any? { |a| a['ambiguous'] || a['potential_matches']&.any? }
  end

  # Check if item needs concept review
  def needs_concept_review?
    detected_concepts.any? { |c| c['ambiguous'] || c['suggestions']&.any? }
  end

  private

  def update_batch_counts
    batch_upload.update_counts!
  end
end
