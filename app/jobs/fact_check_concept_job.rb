# Stage 2 of the AI concept generation pipeline.
# Reads the stage-1 draft from the ConceptGeneration row, runs the
# adversarial fact-check via ConceptFactCheckerService, and overwrites
# the content fields with the revised version. Snapshots the pre-fact-check
# state into previous_snapshot so the admin can see what changed.
class FactCheckConceptJob < ApplicationJob
  queue_as :default

  def perform(concept_generation_id)
    generation = ConceptGeneration.find_by(id: concept_generation_id)
    return unless generation
    return unless generation.status_fact_checking? || generation.status_ready_for_review?

    Rails.logger.info "FactCheckConceptJob: starting for ##{generation.id} (#{generation.concept_name})"

    result = ConceptFactCheckerService.new(concept_generation: generation).call

    persist_result!(generation, result)
    Rails.logger.info "FactCheckConceptJob: completed for ##{generation.id} (#{result[:fact_check_notes].length} notes)"
  rescue ConceptFactCheckerService::FactCheckError => e
    Rails.logger.error "FactCheckConceptJob: error for ##{concept_generation_id}: #{e.class} #{e.message}"
    generation&.record_stage_failure!(:fact_check, "#{e.class}: #{e.message}")
  rescue => e
    Rails.logger.error "FactCheckConceptJob: unexpected error for ##{concept_generation_id}: #{e.class} #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    generation&.record_stage_failure!(:fact_check, "#{e.class}: #{e.message}")
    raise
  end

  private

  def persist_result!(generation, result)
    snapshot = ConceptGeneration::CONTENT_FIELDS.each_with_object({}) do |field, hash|
      hash[field] = generation.send(field)
    end

    revised = result[:revised_content] || {}

    attrs = { status: :enriching }
    ConceptGeneration::CONTENT_FIELDS.each do |field|
      attrs[field] = revised[field] if revised.key?(field)
    end

    attrs[:fact_check_notes] = result[:fact_check_notes] || []
    attrs[:previous_snapshot] = (generation.previous_snapshot || {}).merge('after_generate' => snapshot)

    citations = generation.citations.deep_dup || {}
    citations['fact_check'] = result[:citations] || []
    attrs[:citations] = citations

    sources = (generation.web_search_sources || []) + (result[:web_search_sources] || [])
    attrs[:web_search_sources] = sources.uniq { |s| s['url'] }

    token_usage = generation.token_usage.deep_dup || {}
    token_usage['fact_check'] = (result[:usage] || {}).merge('search_queries' => result[:search_queries] || [])
    attrs[:token_usage] = token_usage

    generation.update!(attrs)

    # Chain stage 3.
    job = EnrichConceptLinksJob.perform_later(generation.id)
    generation.update_column(:enrich_job_id, job.job_id)
  end
end
