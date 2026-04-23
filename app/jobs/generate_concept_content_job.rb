# Stage 1 of the AI concept generation pipeline.
# Calls Claude Opus 4.7 via ConceptGeneration::GeneratorService, persists
# the generated content + citations on the ConceptGeneration row, and
# transitions status to :ready_for_review. Later stages (fact-check,
# enrichment) will chain off the success path.
class GenerateConceptContentJob < ApplicationJob
  queue_as :default

  # No automatic retries — failures surface on the generation row for
  # manual retry via the admin UI. Partial/misleading content is worse
  # than a visible failure state.
  def perform(concept_generation_id)
    generation = ConceptGeneration.find_by(id: concept_generation_id)
    return unless generation
    return unless generation.status_generating? || generation.status_pending?

    Rails.logger.info "GenerateConceptContentJob: starting for generation ##{generation.id} (#{generation.concept_name})"

    result = ConceptGeneratorService.new(
      concept_name: generation.concept_name,
      concept_type: generation.concept_type
    ).call

    persist_result!(generation, result)
    Rails.logger.info "GenerateConceptContentJob: completed for generation ##{generation.id}"
  rescue ConceptGeneratorService::GenerationError => e
    Rails.logger.error "GenerateConceptContentJob: error for generation ##{concept_generation_id}: #{e.class} #{e.message}"
    generation&.record_stage_failure!(:generate, "#{e.class}: #{e.message}")
  rescue => e
    Rails.logger.error "GenerateConceptContentJob: unexpected error for generation ##{concept_generation_id}: #{e.class} #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    generation&.record_stage_failure!(:generate, "#{e.class}: #{e.message}")
    raise
  end

  private

  def persist_result!(generation, result)
    content = result[:content] || {}
    attrs = { status: :fact_checking }

    ConceptGeneration::CONTENT_FIELDS.each do |field|
      next unless content.key?(field)

      attrs[field] = content[field]
    end

    attrs[:citations] = { 'generate' => result[:citations] || [] }
    attrs[:web_search_sources] = result[:web_search_sources] || []
    attrs[:token_usage] = { 'generate' => (result[:usage] || {}).merge('search_queries' => result[:search_queries] || []) }

    generation.update!(attrs)

    # Chain stage 2.
    job = FactCheckConceptJob.perform_later(generation.id)
    generation.update_column(:fact_check_job_id, job.job_id)
  end
end
