require 'net/http'
require 'json'

# Detects whether a newly-created concept is actually an alias of, or related to,
# an existing concept in the same user's library.
#
# Pipeline:
#   1. pg_trgm pre-filter against user's other concepts (label + aliases) — cheap
#      lexical similarity, returns top N candidates
#   2. If no candidates: return {aliases: [], related: [], new: true}
#   3. Haiku judges: which (if any) candidates are aliases (same thing) vs
#      related (similar but distinct)
#
# Returns a hash:
#   {
#     aliases: [{id:, label:, confidence:, reasoning:}],   # 0+ — UI confirmation needed for hard merge
#     related: [{id:, label:, rel_type:, reasoning:}],     # 0+ — auto-create Connections
#     new: bool                                            # true if no matches
#   }
class ConceptAliasDetectionService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  TRGM_THRESHOLD = 0.2
  CANDIDATE_LIMIT = 20

  # Pairwise judgement used by the bulk scan flow — given two existing
  # concepts, returns a verdict ("alias" | "related" | "skip"), confidence,
  # and reasoning.  Symmetric in inputs.  Returns nil on API/parse failure.
  def self.judge_pair(a, b)
    return nil if a.label.blank? || b.label.blank?
    return nil unless ENV['ANTHROPIC_API_KEY'].present?

    aliases_a = Array(a.aliases).any? ? " (also: #{Array(a.aliases).join(', ')})" : ""
    aliases_b = Array(b.aliases).any? ? " (also: #{Array(b.aliases).join(', ')})" : ""
    type_a = a.concept_type.present? ? " [#{a.concept_type}]" : ""
    type_b = b.concept_type.present? ? " [#{b.concept_type}]" : ""

    prompt = <<~PROMPT
      You are deduplicating a research-library concept graph.

      Concept A: "#{a.label}"#{type_a}#{aliases_a}
      Concept B: "#{b.label}"#{type_b}#{aliases_b}

      Decide one of:
        - "alias" — they refer to the same thing and should be merged. Be conservative.
        - "related" — distinct but closely related concepts.
        - "skip" — unrelated or only superficially similar.

      Return ONLY a JSON object with no markdown:
      {"verdict": "alias|related|skip", "confidence": "high|medium|low", "reasoning": "<one short sentence>"}
    PROMPT

    response = post_anthropic(prompt, max_tokens: 256)
    return nil unless response.is_a?(Net::HTTPSuccess)

    body = JSON.parse(response.body)
    text = body.dig('content', 0, 'text').to_s.strip
    return nil if text.blank?

    if text.match?(/```/)
      m = text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
      text = m[1] if m
    end
    json_start = text.index('{')
    json_end = text.rindex('}')
    return nil unless json_start && json_end && json_end > json_start

    parsed = JSON.parse(text[json_start..json_end])
    verdict = parsed['verdict'].to_s.downcase
    return nil unless %w[alias related skip].include?(verdict)
    confidence = parsed['confidence'].to_s.downcase
    confidence = "medium" unless %w[high medium low].include?(confidence)
    { verdict: verdict, confidence: confidence, reasoning: parsed['reasoning'].to_s.strip }
  rescue => e
    Rails.logger.error "ConceptAliasDetectionService.judge_pair error: #{e.message}"
    nil
  end

  def self.post_anthropic(prompt, max_tokens: 1024)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 30
    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'
    request.body = {
      model: MODEL,
      max_tokens: max_tokens,
      messages: [{ role: 'user', content: prompt }]
    }.to_json
    http.request(request)
  end

  def initialize(concept)
    @concept = concept
    @user = concept.user
  end

  def detect
    return empty_result if @concept.label.blank?

    candidates = fetch_candidates
    return empty_result if candidates.empty?
    return empty_result unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic_api(candidates)
    parse_response(response, candidates)
  rescue => e
    Rails.logger.error "ConceptAliasDetectionService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    empty_result
  end

  private

  def empty_result
    { aliases: [], related: [], new: true }
  end

  def fetch_candidates
    label = @concept.label
    # Exclude any candidate the user has already marked as "different" from
    # @concept.  Pairs are stored canonically (a_id < b_id), so a single OR
    # covers both orderings.
    sql = <<~SQL
      SELECT id, label, aliases, concept_type,
             GREATEST(
               similarity(label, $1),
               COALESCE((SELECT MAX(similarity(a, $1)) FROM unnest(aliases) a), 0)
             ) AS sim
      FROM concepts c
      WHERE c.user_id = $2
        AND c.id != $3
        AND (
          similarity(c.label, $1) > $4
          OR EXISTS (SELECT 1 FROM unnest(c.aliases) a WHERE similarity(a, $1) > $4)
        )
        AND NOT EXISTS (
          SELECT 1 FROM concept_disambiguations d
          WHERE d.user_id = $2
            AND ((d.concept_a_id = LEAST($3::bigint, c.id) AND d.concept_b_id = GREATEST($3::bigint, c.id)))
        )
      ORDER BY sim DESC
      LIMIT $5
    SQL

    binds = [label, @user.id, @concept.id, TRGM_THRESHOLD, CANDIDATE_LIMIT]
    rows = ActiveRecord::Base.connection.exec_query(sql, "concept_alias_candidates", binds).to_a
    rows.map(&:symbolize_keys)
  end

  def call_anthropic_api(candidates)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 30

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: build_prompt(candidates) }
      ]
    }.to_json

    http.request(request)
  end

  def build_prompt(candidates)
    candidates_block = candidates.map do |c|
      aliases_part = c[:aliases].present? ? " (also known as: #{Array(c[:aliases]).join(', ')})" : ""
      type_part = c[:concept_type].present? ? " [#{c[:concept_type]}]" : ""
      "- ID #{c[:id]}: \"#{c[:label]}\"#{type_part}#{aliases_part}"
    end.join("\n")

    new_concept_type = @concept.concept_type.present? ? " [#{@concept.concept_type}]" : ""

    <<~PROMPT
      You are deduplicating a research-library concept graph.

      A new concept was just added: "#{@concept.label}"#{new_concept_type}

      Existing concepts in the user's library that are lexically similar:
      #{candidates_block}

      For EACH existing concept above, decide one of:
        - "alias" — it refers to the same thing as the new concept (e.g., "parasocial relationships" and "parasocial interaction"). The new concept will be merged into this existing one. Be conservative; only mark as alias if you are confident they are interchangeable.
        - "related" — it is closely related but a distinct concept (e.g., "parasocial relationships" and "celebrity worship"). A "related_to" link will be created.
        - "skip" — neither the same nor closely related; ignore it.

      Return ONLY a valid JSON object with this shape, no markdown:
      {
        "decisions": [
          {"id": <existing concept id>, "verdict": "alias|related|skip", "confidence": "high|medium|low", "reasoning": "<one short sentence>"}
        ]
      }

      Include one entry per candidate above. Do not invent IDs.
    PROMPT
  end

  def parse_response(response, candidates)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "ConceptAliasDetectionService API failed: #{response.code} #{response.body}"
      return empty_result
    end

    result = JSON.parse(response.body)
    text = result.dig('content', 0, 'text').to_s.strip
    return empty_result if text.blank?

    if text.match?(/```/)
      m = text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
      text = m[1] if m
    end

    json_start = text.index('{')
    json_end = text.rindex('}')
    return empty_result unless json_start && json_end && json_end > json_start

    parsed = JSON.parse(text[json_start..json_end])
    decisions = Array(parsed['decisions'])

    candidate_lookup = candidates.index_by { |c| c[:id] }

    aliases = []
    related = []

    decisions.each do |d|
      id = d['id'].to_i
      cand = candidate_lookup[id]
      next unless cand

      verdict = d['verdict'].to_s.downcase
      reasoning = d['reasoning'].to_s.strip
      confidence = d['confidence'].to_s.downcase
      confidence = "medium" unless %w[high medium low].include?(confidence)

      case verdict
      when 'alias'
        aliases << { id: id, label: cand[:label], confidence: confidence, reasoning: reasoning }
      when 'related'
        related << { id: id, label: cand[:label], rel_type: 'related_to', reasoning: reasoning }
      end
    end

    {
      aliases: aliases,
      related: related,
      new: aliases.empty? && related.empty?
    }
  rescue JSON::ParserError => e
    Rails.logger.error "ConceptAliasDetectionService JSON parse error: #{e.message}"
    empty_result
  end
end
