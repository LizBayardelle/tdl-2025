class UploadBatchItem < ApplicationRecord
  belongs_to :upload_batch
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

  validates :upload_batch_id, presence: true
  validates :status, presence: true

  scope :pending_processing, -> { where(status: [:pending, :uploading, :extracting]) }
  scope :needs_review, -> { where(status: :review_needed) }
  scope :ready_for_approval, -> { where(status: [:extracted, :review_needed]) }
  scope :completed, -> { where(status: [:approved, :created, :skipped]) }
  scope :skipped, -> { where(status: :skipped) }
  scope :failed, -> { where(status: :failed) }

  delegate :user, to: :upload_batch

  after_save :update_batch_counts, if: :saved_change_to_status?

  def start_extraction!
    return unless status_pending?

    update!(status: :extracting)
    ProcessBulkUploadItemJob.perform_later(id)
  end

  def needs_review!(reason = nil)
    update!(
      status: :review_needed,
      user_decisions: user_decisions.merge('review_reason' => reason)
    )
  end

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

  def mark_failed!(message)
    increment!(:retry_count)
    update!(
      status: :failed,
      error_message: message
    )
  end

  def approve!(decisions = {})
    return unless status_extracted? || status_review_needed?

    update!(
      status: :approved,
      user_decisions: decisions
    )
    CreateSourceFromUploadJob.perform_later(id)
  end

  def retry!
    return unless status_failed?

    update!(
      status: :pending,
      error_message: nil
    )
    start_extraction!
  end

  def skip!
    return if status_approved? || status_created? || status_skipped?

    update!(status: :skipped)
    pdf.purge if pdf.attached?
  end

  def display_metadata
    extracted_metadata.merge(
      'original_filename' => original_filename,
      'extracted_doi' => extracted_doi,
      'extraction_method' => extraction_method
    )
  end

  def has_duplicates?
    duplicate_candidates.present? && duplicate_candidates.any?
  end

  def needs_author_review?
    detected_authors.any? { |a| a['ambiguous'] || a['potential_matches']&.any? }
  end

  def needs_concept_review?
    detected_concepts.any? { |c| c['ambiguous'] || c['suggestions']&.any? }
  end

  private

  def update_batch_counts
    upload_batch.update_counts!
  end
end
