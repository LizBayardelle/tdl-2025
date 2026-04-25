class ConceptGeneration < ApplicationRecord
  CONTENT_FIELDS = %w[
    label aliases summary description location examples etymology
    school_of_thought history controversy clinical_relevance
    misconceptions mnemonic developmental_notes measurement_notes
    attribution
  ].freeze

  belongs_to :batch, class_name: 'ConceptGenerationBatch', foreign_key: :concept_generation_batch_id
  belongs_to :target_concept_definition, class_name: 'ConceptDefinition', optional: true
  belongs_to :approved_concept_definition, class_name: 'ConceptDefinition', optional: true

  enum :status, {
    pending: 'pending',
    generating: 'generating',
    fact_checking: 'fact_checking',
    enriching: 'enriching',
    ready_for_review: 'ready_for_review',
    approved: 'approved',
    rejected: 'rejected',
    failed: 'failed'
  }, prefix: true

  enum :target_mode, {
    create_new: 'create_new',
    regenerate_existing: 'regenerate_existing'
  }, prefix: true

  validates :concept_name, presence: true
  validates :status, presence: true
  validates :target_mode, presence: true

  after_save :update_batch_counts, if: :saved_change_to_status?

  def start_generation!
    return unless status_pending?

    update!(status: :generating)
    job = GenerateConceptContentJob.perform_later(id)
    update_column(:generate_job_id, job.job_id)
  end

  def record_stage_failure!(stage, error_message)
    errors = stage_errors.dup
    errors[stage.to_s] = {
      'message' => error_message,
      'at' => Time.current.iso8601
    }
    update!(status: :failed, stage_errors: errors)
  end

  private

  def update_batch_counts
    batch.update_counts!
  end
end
