class ConceptGenerationBatch < ApplicationRecord
  belongs_to :user
  has_many :concept_generations, dependent: :destroy

  enum :status, {
    pending: 'pending',
    generating: 'generating',
    review: 'review',
    completed: 'completed',
    failed: 'failed'
  }, prefix: true

  validates :status, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :active, -> { where(status: [:pending, :generating, :review]) }

  def start_processing!
    return unless status_pending?

    update!(status: :generating, started_at: Time.current)
    concept_generations.where(status: :pending).find_each(&:start_generation!)
  end

  def update_counts!
    items = concept_generations
    update!(
      total_count: items.count,
      generated_count: items.where(status: [:ready_for_review, :approved, :rejected]).count,
      approved_count: items.where(status: :approved).count,
      rejected_count: items.where(status: :rejected).count,
      failed_count: items.where(status: :failed).count
    )
    check_completion!
  end

  def check_completion!
    items = concept_generations
    return if items.empty?

    in_progress = items.where(status: [:pending, :generating, :fact_checking, :enriching])
    return if in_progress.any?

    if status_generating? && items.where(status: :ready_for_review).any?
      update!(status: :review)
    elsif status_review? && items.where(status: [:approved, :rejected, :failed]).count == items.count
      update!(status: :completed, completed_at: Time.current)
    end
  end

  def progress_percentage
    return 0 if total_count.to_i.zero?

    processed = concept_generations.where.not(status: [:pending, :generating, :fact_checking, :enriching]).count
    (processed.to_f / total_count * 100).round
  end

  def stats
    counts = concept_generations.group(:status).count
    {
      total: total_count,
      pending: counts['pending'] || 0,
      generating: counts['generating'] || 0,
      fact_checking: counts['fact_checking'] || 0,
      enriching: counts['enriching'] || 0,
      ready_for_review: counts['ready_for_review'] || 0,
      approved: counts['approved'] || 0,
      rejected: counts['rejected'] || 0,
      failed: counts['failed'] || 0
    }
  end
end
