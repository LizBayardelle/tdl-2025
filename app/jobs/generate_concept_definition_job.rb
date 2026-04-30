require 'set'

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
  # fact-check + link enrichment + DB write.  The realistic tail for the
  # Sonnet→Sonnet pipeline is 6-9 minutes — fact-check alone has been
  # observed at 240+ seconds.  We bound at 12 minutes so legitimate
  # generations can finish; anything longer is broken and the user
  # shouldn't keep paying for the quota slot.
  GENERATION_TIMEOUT_SECONDS = 720

  # Cap on entries written to ConceptDefinition#external_refs.  The model
  # produces 50+ raw refs at 12 web searches, mostly duplicates of the
  # same handful of canonical sources.  7 keeps the show-page rail useful
  # without being a wall of links.
  MAX_FURTHER_READING = 7

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

      # Cache re-check: another user may have generated a matching
      # ConceptDefinition between when this job was enqueued and when it
      # acquired the lock.  Linking instead of regenerating saves ~$0.30
      # and keeps the user's quota slot intact (refunded here).
      cached = ConceptDefinition.best_match_for(
        slug: concept.label.to_s.parameterize,
        concept_type: concept.concept_type,
      )
      if cached
        Rails.logger.info "GenerateConceptDefinitionJob: concept #{concept_id} cache-hit on definition #{cached.id} after lock, linking and refunding"
        concept.update!(definition_id: cached.id, definition_acquired_via: 'cache_hit')
        ConceptDefinition.increment_counter(:linked_count_cache, cached.id)
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

      # Combine citations + web sources into a single external_refs payload
      # for the show page's "Further Reading" rail.  The model often
      # re-cites the same URL across many fields, so dedupe by canonical
      # URL and by lowercased title — different URLs (Wikipedia anchors,
      # alternate ScienceDirect routes) frequently share a title and we
      # never want both.  Capped at MAX_FURTHER_READING so the rail stays
      # a curated list rather than a research dump.
      refs = []
      seen_keys = Set.new
      seen_titles = Set.new
      add_ref = lambda do |type, title, url|
        return if url.blank?
        key = canonical_url(url)
        return if key.empty? || seen_keys.include?(key)
        title_key = title.to_s.strip.downcase
        return if !title_key.empty? && seen_titles.include?(title_key)
        seen_keys << key
        seen_titles << title_key unless title_key.empty?
        refs << { 'type' => type, 'title' => title.presence || url, 'url' => url }
      end

      Array(result[:citations]).each do |c|
        next unless c.is_a?(Hash)
        add_ref.call('citation', c['title'] || c[:title], c['url'] || c[:url])
        break if refs.size >= MAX_FURTHER_READING
      end
      Array(result[:web_search_sources]).each do |s|
        next unless s.is_a?(Hash)
        add_ref.call('source', s['title'] || s[:title], s['url'] || s[:url])
        break if refs.size >= MAX_FURTHER_READING
      end
      attrs['external_refs'] = refs

      attrs['linked_count_cache'] = 1 # original requester counts as the first link
      definition = ConceptDefinition.create!(attrs)
      concept.update!(definition_id: definition.id, definition_acquired_via: 'fresh_gen')

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

  # Mirror of the frontend canonicalUrl in ConceptShow.js: host + path,
  # lowercased, www. stripped, trailing slash and fragment removed.
  # Wikipedia anchors and trailing-slash variants collapse to one entry.
  def canonical_url(url)
    return '' if url.blank?
    uri = URI.parse(url.to_s.strip)
    host = uri.host.to_s.downcase.sub(/^www\./, '')
    path = uri.path.to_s.sub(/\/\z/, '')
    "#{host}#{path}".downcase
  rescue URI::InvalidURIError
    url.to_s.downcase.strip
  end

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
