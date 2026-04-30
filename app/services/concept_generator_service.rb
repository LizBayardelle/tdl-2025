require 'json'

# Stage 1 of concept generation: drafts a fresh concept entry using
# Claude Sonnet 4.6 + web_search restricted to the AllowedDomain whitelist.
# Returns the structured content fields + citations + sources.
#
# Streaming, retries, and pause_turn handling live in AnthropicStreamingClient.
class ConceptGeneratorService
  class GenerationError < StandardError; end
  class ApiError < GenerationError; end
  class ParseError < GenerationError; end
  class MissingApiKey < GenerationError; end

  # Sonnet 4.6 for stage 1 — equally good at "search + structure" work,
  # 2-3x faster than Opus, and draws from a separate rate-limit budget.
  # Stage 2 (fact-check) uses Opus 4.7 where adversarial reasoning matters more.
  MODEL = 'claude-sonnet-4-6'
  MAX_TOKENS = 16_000
  MAX_SEARCHES = 12

  CONTENT_FIELDS = ConceptGeneration::CONTENT_FIELDS

  def initialize(concept_name:, concept_type: nil, logger: Rails.logger, client: nil)
    @concept_name = concept_name.to_s.strip
    @concept_type = concept_type.presence
    @logger = logger
    @client = client || AnthropicStreamingClient.new(logger: logger)
  end

  def call
    raise GenerationError, 'concept_name is required' if @concept_name.blank?

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
    # allowed_callers: ['direct'] keeps the tool in server-managed direct
    # mode — Anthropic runs the search and streams results back as
    # web_search_tool_result blocks.  Without this, web_search_20260209
    # defaults to programmatic mode, where the model writes Python that
    # calls web_search inside a code_execution sandbox.  We don't include
    # code_execution in the tool list, so programmatic mode hangs until
    # the request times out.  See LinkEnrichmentService for the same fix.
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: MAX_SEARCHES,
      allowed_domains: AllowedDomain.active_domains,
      allowed_callers: ['direct'],
    }
  end

  def user_message_text
    parts = [%(Generate a complete concept entry for: "#{@concept_name}")]
    parts << "Classify as concept_type: #{@concept_type}" if @concept_type
    parts << "Follow the schema and hedging rules from the system prompt exactly. Return the final JSON object in a fenced ```json block."
    parts.join("\n\n")
  end

  # Kept byte-stable for prompt caching. Do not interpolate dates, user
  # names, or any varying data into this string.
  def system_prompt
    <<~PROMPT
      You are an expert writer of concept entries for a neuroscience, psychology, and psychiatry reference for clinicians and serious students. Your output is read by people who need factual accuracy, honest epistemic standing, and citations to authoritative sources.

      ## Your task

      Given a concept name (and optional concept type), research the concept using the web_search tool, then produce a structured JSON object containing the concept's full entry. Always ground empirical claims in sources returned by the search tool. Never invent facts or citations.

      ## Content fields

      Fill every applicable field. If a field does not apply to this concept (for example, a non-anatomical concept has no meaningful "location"), omit it or leave it null rather than fabricating content. Do not force fields to be filled.

      ### Formatting rule for prose fields

      Any field whose value runs more than ~80 words MUST be broken into 2-3 paragraphs separated by a blank line (a literal `\n\n` in the JSON string). Use a paragraph break wherever the topic shifts — for example, between mechanism and clinical implications, between historical context and the current state, between mainstream view and dissent. Do not write a wall of text. Short fields (under ~80 words) stay as a single paragraph.

      - **label**: The canonical name of the concept in Title Case. Usually matches the input, but may be normalized (e.g., "frontal lobes" → "Frontal Lobe").
      - **aliases**: Array of other names, abbreviations, or spellings the concept goes by. Empty array if none.
      - **summary**: One or two sentences capturing what this concept IS and why it matters. Written for a reader who has just encountered the term. Single paragraph.
      - **description**: Two to four paragraphs of detailed explanation, separated by blank lines. Assume the reader has a general science background but is not a specialist in this sub-field. Cover structure, function, and position within its broader domain — let the paragraph breaks track those shifts.
      - **location**: Where the concept is found anatomically, or its position within a taxonomy of ideas if non-physical. Usually one paragraph; two if anatomical position and functional position are both relevant.
      - **examples**: Concrete instances, cases, or manifestations that help anchor the concept. Optional for abstract concepts. Break into paragraphs if you have multiple distinct examples.
      - **etymology**: Linguistic origin of the term, including root language and literal meaning. One to three sentences, single paragraph.
      - **school_of_thought**: The intellectual tradition(s) that developed or defined this concept (e.g., "Anatomy", "Cognitive neuroscience", "Psychoanalysis"). Keep short.
      - **history**: How the concept was discovered, articulated, or evolved. Mention key figures, dates, and shifts in understanding. 1-3 paragraphs — break between discovery and modern understanding if both are substantive.
      - **controversy**: Active scholarly disagreements about the concept — definitional boundaries, mechanism, interpretation. Only include genuine disagreements, not settled science. 1-3 paragraphs, with a paragraph per distinct debate when there are multiple.
      - **clinical_relevance**: If applicable, how the concept manifests in clinical practice — associated syndromes, diagnostic significance, therapeutic targeting. 1-3 paragraphs — break between diagnostic and therapeutic considerations when both apply.
      - **misconceptions**: Common errors, oversimplifications, or popular-media distortions about this concept. Correct them briefly. 1-3 paragraphs, with a paragraph per distinct misconception when there are multiple.
      - **mnemonic**: A memory aid for learning the concept. IMPORTANT: If you compose one yourself rather than retrieving an established mnemonic from an educational source, append: "Note: This mnemonic was composed for this entry and is not from an established educational source. Use as a starting point and adapt." Be honest about the provenance. Single paragraph.
      - **developmental_notes**: How the concept manifests or changes across the lifespan (prenatal through aging), where relevant. 1-3 paragraphs — break between life stages if you cover several.
      - **measurement_notes**: How the concept is assessed or quantified in research and clinical settings — common instruments, neuroimaging paradigms, behavioral tests. 1-3 paragraphs — break between methodologies (self-report vs. behavioral vs. neuroimaging) when relevant.
      - **attribution**: Where this concept primarily originates from or is defined by, in plain academic citation form (e.g., "DSM-5 (APA, 2013)", "ICD-11 (WHO, 2019)", "Originally proposed by Aaron Beck (1967)", "Brodmann (1909)"). One short line. Leave null if there is no single named source — for example, broad anatomical structures or constructs that emerged across the literature without a canonical originator.

      ## Required hedging

      Preserve genuine uncertainty. Do not flatten contested or developing science into confident assertion. Specifically:

      1. For claims that are active research areas, use phrases like "as of recent reviews," "an active area of research," "not yet settled." Do not cite a specific date unless a source provides one.
      2. For claims where a popular mapping is often overstated in pop-science but is more nuanced in the literature (for example, "prefrontal myelination causes adolescent impulsivity"), describe it as a hypothesis or as "commonly cited but debated," not as established fact.
      3. For claims where sources disagree, say so explicitly in the relevant field (often controversy or measurement_notes), rather than picking a side silently.
      4. For any generated mnemonic, follow the mnemonic rule above — never pass off a composed mnemonic as an established one.
      5. Never cite a source by name unless web_search actually returned it. Do not invent author names, journal titles, or dates.

      ## Source grounding

      Use web_search for every empirical or historical claim. The search tool is restricted to a whitelist of authoritative domains (medical, research, reference). When you frame a search, favor definitional / overview queries about the concept itself ("parietal lobe overview", "anxiety disorder definition", "cerebellum StatPearls") over queries that hunt for adjacent primary research. The collected sources also seed the reader's "learn more" link list, so reference pages, disease-overview pages, and textbook chapters are more useful than single-study papers. If searches return too little useful content on a particular claim, say so in the relevant field rather than padding with inference.

      ## Copyright guardrails

      This entry is part of a paid reference product for clinicians and students. Do not reproduce protected material:

      - Do not reproduce the structure, organization, or phrasing of any diagnostic manual, clinical reference, or copyrighted text — including the DSM, ICD, PDR, or any named assessment instrument.
      - Do not reproduce any items, questions, or scoring criteria from validated psychological or medical assessment instruments (e.g., PHQ-9, Beck Depression Inventory, MMPI, GAD-7). Describe what they measure and how they're used, never their actual content.
      - Where a concept originates from or is defined by a specific named source, populate the `attribution` field with a plain academic citation (e.g., "DSM-5 (APA, 2013)", "Originally proposed by Aaron Beck (1967)") and describe the concept itself in wholly original language, not the source's wording.
      - Write as an educator synthesizing the scientific literature, not as a reference work transcribing it.

      ## Tone and framing

      - Synthesize from general scientific knowledge across the literature.
      - Prefer original explanatory language over terminology lifted directly from any single source.
      - When describing diagnostic criteria, convey their conceptual meaning rather than their manual wording.
      - Do not use em dashes (—) in any output field. Use commas, parentheses, colons, or two short sentences instead. Hyphens in compound words ("non-physical", "well-known") are fine; long em dashes are not.

      ## Output format

      Return a single JSON object wrapped in a fenced ```json block. Keys: the content fields listed above. Values: strings (or string arrays for `aliases`). Omit any field that genuinely does not apply rather than filling with filler text. Do not include commentary outside the JSON block; you may include brief reasoning before the block if helpful, but the JSON block is the authoritative output.

      CRITICAL JSON FORMATTING: Multi-paragraph string values must use the escape sequence `\\n\\n` to separate paragraphs — NEVER insert a literal newline character inside a JSON string. Each string value must fit on a single line in the source JSON (the escape sequences render as real newlines when parsed). This is strict JSON, not YAML or Markdown.

      Example skeleton (do not copy values):

      ```json
      {
        "label": "Concept Name",
        "aliases": ["Other Name", "Abbreviation"],
        "summary": "...",
        "description": "...",
        "location": "...",
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
      }
      ```
    PROMPT
  end

  def parse_output(content_blocks, usage_totals)
    json_text = extract_json_text(content_blocks)
    raise ParseError, 'No JSON block found in response' if json_text.blank?

    parsed = JSON.parse(json_text)
    raise ParseError, "Expected JSON object, got #{parsed.class}" unless parsed.is_a?(Hash)

    content = CONTENT_FIELDS.each_with_object({}) do |field, hash|
      value = parsed[field]
      next if value.nil?
      next if value.is_a?(String) && value.strip.empty?

      hash[field] = value
    end

    {
      content: content,
      citations: extract_citations(content_blocks),
      web_search_sources: extract_search_sources(content_blocks),
      search_queries: extract_search_queries(content_blocks),
      usage: usage_totals.merge('web_search_requests' => web_search_request_count(usage_totals)),
      raw_json: parsed
    }
  end

  def web_search_request_count(usage)
    usage['web_search_requests'].to_i
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

  # Fix the most common JSON sin Claude commits: literal control chars
  # (newlines, tabs) inside string values instead of escape sequences.
  # Walk char-by-char, track whether we're inside a string literal
  # (respecting backslash escapes), and escape any raw control chars there.
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
        # Direct-mode shape — server runs the search, model emits a
        # server_tool_use block with the query in input.query.
        q = b.dig('input', 'query')
        queries << q if q.present?
      when 'code_execution'
        # Programmatic-mode shape, kept defensively in case the tool
        # config ever drops allowed_callers: ['direct']: Claude writes
        # Python that calls web_search({"query": "..."}).
        code = b.dig('input', 'code').to_s
        code.scan(/web_search\(\s*\{\s*["']query["']\s*:\s*["']([^"']+)["']/).each do |m|
          queries << m[0]
        end
      end
    end

    queries
  end
end
