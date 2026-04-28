# Generates a ConceptDefinition for an existing user concept on demand.
# Wraps ConceptGeneratorService (Sonnet 4.6 + web search) and writes the
# result straight to a fresh ConceptDefinition record, auto-approved with
# no review queue.  The user's concept_generations counter is consumed
# before the job fires so we don't pay for over-quota calls.
class GenerateConceptDefinitionJob < ApplicationJob
  queue_as :default

  CONTENT_FIELDS = %w[
    label aliases summary description location examples etymology
    school_of_thought history controversy clinical_relevance
    misconceptions mnemonic developmental_notes measurement_notes
    attribution
  ].freeze

  # First arg of the two-arg pg_advisory_lock pair — gives this lock its
  # own namespace so it can never collide with future advisory-lock uses
  # keyed on the same id.  Arbitrary but stable.
  ADVISORY_LOCK_NAMESPACE = 0x6F1A_7A0B # "concept-def gen"

  # Hard ceiling on total wall-clock for one generation: AI call +
  # fact-check + link enrichment + DB write.  Anthropic's per-request
  # read_timeout is 180s, but the pipeline is multi-stage, so we bound
  # the whole pipeline at 5 minutes.  Anything longer is broken and the
  # user shouldn't keep paying for the quota slot.
  GENERATION_TIMEOUT_SECONDS = 300

  def perform(concept_id, user_id)
    concept = Concept.find_by(id: concept_id)
    user    = User.find_by(id: user_id)
    return unless concept && user
    return if concept.definition_id.present? # idempotent — already generated

    # Advisory lock keyed on concept_id prevents two concurrent jobs for
    # the same concept from both calling the AI and racing to set
    # definition_id (which would orphan one ConceptDefinition and waste
    # ~$0.30).  If we can't get the lock, another job is mid-flight; we
    # refund this enqueue's quota and bail — the other job will produce
    # the definition this user paid for.
    unless try_advisory_lock(concept_id)
      Rails.logger.info "GenerateConceptDefinitionJob: concept #{concept_id} already generating, refunding and skipping"
      refund_quota(user_id)
      return
    end

    begin
      # Re-check now that we hold the lock — the other job may have just
      # finished while we were waiting in the queue.
      concept.reload
      if concept.definition_id.present?
        Rails.logger.info "GenerateConceptDefinitionJob: concept #{concept_id} now has definition, refunding and skipping"
        refund_quota(user_id)
        return
      end

      Rails.logger.info "GenerateConceptDefinitionJob: concept #{concept_id} user #{user_id}"

      result = Timeout.timeout(GENERATION_TIMEOUT_SECONDS) do
        ConceptGeneratorService.new(
          concept_name: concept.label,
          concept_type: concept.effective_concept_type,
          logger: Rails.logger,
        ).call
      end

      content = result[:content] || {}

      # Build attrs for the ConceptDefinition record.
      attrs = CONTENT_FIELDS.each_with_object({}) do |field, hash|
        value = content[field]
        hash[field] = value unless value.nil? || (value.respond_to?(:strip) && value.strip.empty?)
      end
      attrs['label']        ||= concept.label
      attrs['concept_type'] ||= concept.effective_concept_type

      # Combine citations + web sources into a single external_refs payload.
      # Each entry is { type:, title:, url: } — used by the show page's
      # "Further Reading" rail at the bottom.
      refs = []
      Array(result[:citations]).each do |c|
        next unless c.is_a?(Hash)
        url = c['url'] || c[:url]
        next if url.blank?
        refs << { 'type' => 'citation', 'title' => c['title'] || c[:title] || url, 'url' => url }
      end
      Array(result[:web_search_sources]).each do |s|
        next unless s.is_a?(Hash)
        url = s['url'] || s[:url]
        next if url.blank?
        next if refs.any? { |r| r['url'] == url }
        refs << { 'type' => 'source', 'title' => s['title'] || s[:title] || url, 'url' => url }
      end
      attrs['external_refs'] = refs

      definition = ConceptDefinition.create!(attrs)
      concept.update!(definition_id: definition.id)

      Rails.logger.info "GenerateConceptDefinitionJob: wrote definition #{definition.id} for concept #{concept_id}"
    rescue Timeout::Error => e
      Rails.logger.error "GenerateConceptDefinitionJob timed out for concept #{concept_id} after #{GENERATION_TIMEOUT_SECONDS}s"
      refund_quota(user_id)
      raise
    rescue => e
      Rails.logger.error "GenerateConceptDefinitionJob failed for concept #{concept_id}: #{e.message}"
      Rails.logger.error e.backtrace.first(8).join("\n")
      # Refund the user's counter since the call didn't produce a definition.
      refund_quota(user_id)
      raise
    ensure
      release_advisory_lock(concept_id)
    end
  end

  private

  def try_advisory_lock(concept_id)
    sql = ActiveRecord::Base.send(
      :sanitize_sql_array,
      ["SELECT pg_try_advisory_lock(?, ?)", ADVISORY_LOCK_NAMESPACE, concept_id]
    )
    ActiveRecord::Base.connection.select_value(sql) == true
  end

  def release_advisory_lock(concept_id)
    sql = ActiveRecord::Base.send(
      :sanitize_sql_array,
      ["SELECT pg_advisory_unlock(?, ?)", ADVISORY_LOCK_NAMESPACE, concept_id]
    )
    ActiveRecord::Base.connection.select_value(sql)
  rescue ActiveRecord::StatementInvalid => e
    Rails.logger.warn "GenerateConceptDefinitionJob: advisory unlock failed for #{concept_id}: #{e.message}"
  end

  def refund_quota(user_id)
    user = User.find_by(id: user_id)
    return unless user
    User.transaction do
      user.lock!
      next_count = [user.concept_generations_used.to_i - 1, 0].max
      user.update_columns(concept_generations_used: next_count)
    end
  end
end
