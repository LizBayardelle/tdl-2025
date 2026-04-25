require 'json'

# Stage 2: adversarial fact-check pass over a stage-1 draft.
#
# Reads the current content fields off a ConceptGeneration row, sends them
# to Claude Opus 4.7 with an adversarial system prompt that asks the model
# to find errors / overstated claims / missing hedging / fabricated facts,
# then returns:
#
#   { revised_content: { ...same fields as stage 1... },
#     fact_check_notes: [ { field:, issue:, change: }, ... ],
#     citations: [...], web_search_sources: [...], search_queries: [...],
#     usage: {...} }
#
# Even when no issues are found, revised_content is returned (possibly
# identical to the input). fact_check_notes may be empty.
class ConceptFactCheckerService
  class FactCheckError < StandardError; end
  class ApiError < FactCheckError; end
  class ParseError < FactCheckError; end
  class MissingApiKey < FactCheckError; end

  # Opus 4.7 — adversarial reasoning ("find what's wrong") benefits more
  # from the strongest model than stage 1's "search and structure" work does.
  MODEL = 'claude-opus-4-7'
  MAX_TOKENS = 16_000
  MAX_SEARCHES = 8 # fewer than stage 1; we're verifying claims, not exploring

  CONTENT_FIELDS = ConceptGeneration::CONTENT_FIELDS

  def initialize(concept_generation:, logger: Rails.logger, client: nil)
    @generation = concept_generation
    @logger = logger
    @client = client || AnthropicStreamingClient.new(logger: logger)
  end

  def call
    raise FactCheckError, 'concept_generation has no content to fact-check' if draft_content.empty?

    result = @client.call(
      build_request_body,
      user_message_text: user_message_text
    )

    parse_output(result[:content_blocks], result[:usage])
  rescue AnthropicStreamingClient::MissingApiKey => e
    raise MissingApiKey, e.message
  rescue AnthropicStreamingClient::ApiError => e
    raise ApiError, e.message
  rescue JSON::ParserError => e
    raise ParseError, "Failed to parse JSON response: #{e.message}"
  end

  private

  def draft_content
    @draft_content ||= CONTENT_FIELDS.each_with_object({}) do |field, hash|
      value = @generation.send(field)
      hash[field] = value unless value.nil? || (value.is_a?(String) && value.strip.empty?)
    end
  end

  def build_request_body
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      tools: [web_search_tool],
      system: [
        { type: 'text', text: system_prompt, cache_control: { type: 'ephemeral' } }
      ],
      messages: [{ role: 'user', content: user_message_text }]
    }
  end

  def web_search_tool
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: MAX_SEARCHES,
      allowed_domains: AllowedDomain.active_domains
    }
  end

  def user_message_text
    <<~TXT
      Concept: "#{@generation.concept_name}"#{" (#{@generation.concept_type})" if @generation.concept_type.present?}

      Below is a draft concept entry produced by a different model. Your job is to fact-check and improve it. Read every field critically, use web_search to verify specific empirical or historical claims when in doubt, then return a corrected JSON object plus a list of notes describing what you changed and why.

      DRAFT:

      ```json
      #{JSON.pretty_generate(draft_content)}
      ```

      Follow the rules in the system prompt for what to look for and how to structure the output.
    TXT
  end

  # Kept byte-stable for prompt caching.
  def system_prompt
    <<~PROMPT
      You are a senior editor and subject-matter expert in neuroscience, psychology, and psychiatry. A draft concept entry has been written by another AI. Your job is to find what is WRONG with it and produce a corrected version. You are NOT writing a better entry from scratch — you are auditing the draft.

      ## What to look for

      Read every field with adversarial intent. Specifically check for:

      1. **Factual errors.** Names, dates, anatomical relationships, causal claims, numerical values. If a claim is empirically checkable, verify it via web_search before accepting or rewriting it.
      2. **Overstated claims.** "Causes" where "is associated with" is more accurate. "Established" where "an active area of research" is more honest. "Always" / "never" where the literature is more nuanced.
      3. **Missing hedging on contested or developing science.** If a claim is genuinely contested or still under active investigation, the entry must say so. Common pop-science overstatements (e.g., "the prefrontal cortex finishes developing at 25" as a hard fact) should be softened.
      4. **Fabricated specifics.** Author names, paper titles, dates, exact statistics that can't be verified via web_search should be removed or rewritten in general terms.
      5. **Mnemonic provenance.** If the draft includes a composed mnemonic, it MUST end with the disclaimer: "Note: This mnemonic was composed for this entry and is not from an established educational source. Use as a starting point and adapt." If the disclaimer is missing, add it. If the mnemonic is presented as established/canonical without sourcing, demote it.
      6. **Misclassification.** If the draft conflates one concept with a related-but-distinct one, fix the boundaries.
      7. **Missing controversy.** If there are well-known active debates that the draft glosses over, add them to the controversy field.
      8. **Copyright lift.** This entry is part of a paid reference product. If the draft reproduces the structure, organization, or phrasing of a diagnostic manual (DSM, ICD, PDR), a clinical reference, or any item / question / scoring criterion from a validated assessment instrument (PHQ-9, Beck Depression Inventory, MMPI, GAD-7, etc.), rewrite that passage in wholly original explanatory language. Describe what an instrument measures and how it's used; never reproduce its actual items or wording. When describing diagnostic criteria, convey their conceptual meaning rather than their manual wording.
      9. **Source attribution.** If the concept originates from or is defined by a specific named source (e.g., DSM-5, ICD-11, a particular researcher's work), the `attribution` field must be populated with a plain academic citation — for example, "DSM-5 (APA, 2013)", "ICD-11 (WHO, 2019)", "Originally proposed by Aaron Beck (1967)". Add or correct it if missing or wrong. Leave `attribution` null only when the concept genuinely has no single named source.
      10. **Em dashes.** Replace every em dash (—) in the draft with commas, parentheses, colons, or two shorter sentences, whichever fits the sentence best. Hyphens in compound words ("non-physical", "well-known") are fine; long em dashes are not. This is a non-discretionary style fix — apply it even when nothing else about the passage is wrong.

      ## What NOT to do

      - Do not rewrite a field just to use different prose. Only change content if it is wrong, overstated, missing hedging, factually unsupported, or reproduces protected material.
      - Do not introduce new facts that weren't in the draft AND aren't supported by a web_search result.
      - Do not introduce DSM/ICD-style structured diagnostic criteria, manual phrasing, or assessment-instrument items into a field where they weren't already present, even when "tightening" the language.
      - Do not remove fields that were present unless the field genuinely doesn't apply to this concept.

      ## Use web_search judiciously

      The search tool is restricted to a whitelist of authoritative medical/research/reference domains. Search when you need to verify a specific claim. Do not search for things you already have high confidence in. You have a soft cap of #{MAX_SEARCHES} searches; use them on the highest-stakes claims.

      ## Output format

      Return a single JSON object wrapped in a fenced ```json block, with EXACTLY these top-level keys:

      ```json
      {
        "revised_content": {
          "label": "...",
          "aliases": ["..."],
          "summary": "...",
          "description": "...",
          "location": "...",
          "examples": "...",
          "etymology": "...",
          "school_of_thought": "...",
          "history": "...",
          "controversy": "...",
          "clinical_relevance": "...",
          "misconceptions": "...",
          "mnemonic": "...",
          "developmental_notes": "...",
          "measurement_notes": "...",
          "attribution": "..."
        },
        "fact_check_notes": [
          {
            "field": "history",
            "severity": "minor | moderate | major",
            "issue": "Brief description of what was wrong",
            "change": "Brief description of what you changed"
          }
        ]
      }
      ```

      `revised_content` MUST contain every field that was in the draft (with corrections applied where needed; unchanged where the draft was already correct). Omit a field only if it genuinely doesn't apply to this concept and was incorrectly included.

      `fact_check_notes` lists every meaningful change you made, one entry per change. If the draft passed without changes, return an empty array.

      CRITICAL JSON FORMATTING: Multi-paragraph string values must use the escape sequence `\\n\\n` to separate paragraphs — NEVER insert a literal newline character inside a JSON string. Each string value must fit on a single line in the source JSON. This is strict JSON, not YAML or Markdown.
    PROMPT
  end

  def parse_output(content_blocks, usage_totals)
    json_text = extract_json_text(content_blocks)
    raise ParseError, 'No JSON block found in response' if json_text.blank?

    parsed = JSON.parse(json_text)
    raise ParseError, "Expected JSON object, got #{parsed.class}" unless parsed.is_a?(Hash)

    revised = parsed['revised_content'] || {}
    raise ParseError, "Missing revised_content in fact-check response" unless revised.is_a?(Hash)

    notes = parsed['fact_check_notes'] || []
    notes = [] unless notes.is_a?(Array)

    revised_content = CONTENT_FIELDS.each_with_object({}) do |field, hash|
      value = revised[field]
      next if value.nil?
      next if value.is_a?(String) && value.strip.empty?

      hash[field] = value
    end

    {
      revised_content: revised_content,
      fact_check_notes: notes,
      citations: extract_citations(content_blocks),
      web_search_sources: extract_search_sources(content_blocks),
      search_queries: extract_search_queries(content_blocks),
      usage: usage_totals.merge('web_search_requests' => usage_totals['web_search_requests'].to_i),
      raw_json: parsed
    }
  end

  def extract_json_text(content_blocks)
    combined_text = content_blocks
      .select { |b| b['type'] == 'text' }
      .map { |b| b['text'].to_s }
      .join("\n")

    raw = if (match = combined_text.match(/```json\s*\n(.*?)\n```/m))
      match[1]
    else
      start = combined_text.index('{')
      finish = combined_text.rindex('}')
      return nil unless start && finish && finish > start

      combined_text[start..finish]
    end

    sanitize_json_strings(raw)
  end

  def sanitize_json_strings(text)
    result = String.new(capacity: text.bytesize)
    in_string = false
    escape = false

    text.each_char do |ch|
      if escape
        result << ch
        escape = false
      elsif in_string && ch == '\\'
        result << ch
        escape = true
      elsif ch == '"'
        in_string = !in_string
        result << ch
      elsif in_string
        case ch
        when "\n" then result << '\\n'
        when "\r" then result << '\\r'
        when "\t" then result << '\\t'
        when "\b" then result << '\\b'
        when "\f" then result << '\\f'
        else result << ch
        end
      else
        result << ch
      end
    end

    result
  end

  def extract_citations(content_blocks)
    citations = []
    content_blocks.each do |block|
      next unless block['type'] == 'text'

      Array(block['citations']).each do |c|
        next unless c['type'] == 'web_search_result_location'

        citations << {
          'url' => c['url'],
          'title' => c['title'],
          'cited_text' => c['cited_text']
        }
      end
    end
    citations
  end

  def extract_search_sources(content_blocks)
    sources = []
    content_blocks.each do |block|
      next unless block['type'] == 'web_search_tool_result'

      content = block['content']
      next unless content.is_a?(Array)

      content.each do |r|
        next unless r['type'] == 'web_search_result'

        sources << {
          'url' => r['url'],
          'title' => r['title'],
          'page_age' => r['page_age']
        }
      end
    end
    sources.uniq { |s| s['url'] }
  end

  def extract_search_queries(content_blocks)
    queries = []
    content_blocks.each do |b|
      next unless b['type'] == 'server_tool_use'

      case b['name']
      when 'web_search'
        q = b.dig('input', 'query')
        queries << q if q.present?
      when 'code_execution'
        code = b.dig('input', 'code').to_s
        code.scan(/web_search\(\s*\{\s*["']query["']\s*:\s*["']([^"']+)["']/).each do |m|
          queries << m[0]
        end
      end
    end
    queries
  end
end
