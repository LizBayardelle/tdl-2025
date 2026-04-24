# Stage 3 of the AI concept generation pipeline.
# Pure Ruby — no Claude call. Takes the accumulated web_search_sources
# from stages 1 and 2, dedupes and ranks them by domain authority and
# category diversity, and writes the curated subset to selected_links.
class EnrichConceptLinksJob < ApplicationJob
  queue_as :default

  def perform(concept_generation_id)
    generation = ConceptGeneration.find_by(id: concept_generation_id)
    return unless generation
    return unless generation.status_enriching? || generation.status_ready_for_review? || generation.status_fact_checking?

    Rails.logger.info "EnrichConceptLinksJob: starting for ##{generation.id} (#{generation.concept_name})"

    selected = LinkEnrichmentService.new(concept_generation: generation).call

    generation.update!(
      selected_links: selected,
      status: :ready_for_review,
      enrich_completed_at: Time.current,
      stage_errors: generation.stage_errors.except('enrich')
    )

    Rails.logger.info "EnrichConceptLinksJob: completed for ##{generation.id} (#{selected.length} links)"
  rescue => e
    Rails.logger.error "EnrichConceptLinksJob: error for ##{concept_generation_id}: #{e.class} #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    generation&.record_stage_failure!(:enrich, "#{e.class}: #{e.message}")
    raise
  end
end
