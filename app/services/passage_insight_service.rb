require 'net/http'
require 'json'
require 'set'

# Calls Haiku to summarize a passage selected from a PDF and detect three
# kinds of entities: concept tags, named people, and cited sources (when the
# passage looks like a bibliography fragment).
#
# Cheap by design: passage + source title/abstract + a slice of the user's
# concept and people libraries.  Tool-use forces the response shape so we
# never have to parse free text.
class PassageInsightService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  MAX_PASSAGE_CHARS = 4000
  MAX_CONCEPTS_IN_PROMPT = 80
  MAX_PEOPLE_IN_PROMPT = 80

  PERSON_ROLES = %w[theorist clinician researcher peer client].freeze

  def initialize(passage:, source_title: nil, source_abstract: nil, user_concepts: [], user_people: [])
    @passage = passage.to_s.strip
    @source_title = source_title.to_s.strip
    @source_abstract = source_abstract.to_s.strip
    @user_concepts = user_concepts # [{ id:, label: }]
    @user_people = user_people     # [{ id:, full_name: }]
  end

  # Returns:
  #   {
  #     summary:,
  #     suggested_concepts: [{ id, label }, ...],   # id = nil for novel
  #     suggested_people:   [{ id, full_name, role? }, ...],
  #     cited_sources:      [{ title, authors, year, journal, doi }, ...]
  #   }
  # Returns nil on any error.
  def call
    return nil if @passage.blank?
    return nil unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic
    parse_response(response)
  rescue => e
    Rails.logger.error "PassageInsightService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    nil
  end

  private

  def call_anthropic
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
      max_tokens: 1200,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: 'record_passage_insight' },
      messages: [
        { role: 'user', content: build_prompt }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema
    {
      name: 'record_passage_insight',
      description: 'Record a plain-language summary of the passage and the entities it contains: concept tags, named people, and cited sources.',
      input_schema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'One to three plain-language sentences stating the information directly. Write as if YOU are stating the facts, not describing what some other text says. NEVER start with "This passage…", "The passage…", "The text…", "The author…", "The article…", "It describes…", "It explains…", or any similar meta-language. Just state the content.'
          },
          existing_concept_labels: {
            type: 'array',
            description: 'Labels copied EXACTLY from the user library that the THIS PASSAGE specifically discusses (not just the broader article topic). Skip a library concept if the passage does not directly address it.',
            items: { type: 'string' }
          },
          new_concept_labels: {
            type: 'array',
            description: 'Up to 3 short academic concept labels (2-4 words, title case) drawn from what the PASSAGE specifically discusses. Skip when existing concepts cover it.',
            items: { type: 'string' }
          },
          existing_person_names: {
            type: 'array',
            description: 'People from the user library DISCUSSED substantively in the passage (their work analyzed, their views described, etc). Do NOT include people who only appear as in-text citations like "(Smith, 2020)" or in author lists — those go in cited_sources.',
            items: { type: 'string' }
          },
          new_people: {
            type: 'array',
            description: 'People named in the passage and discussed substantively, NOT in the user library. NEVER include in-text citation authors (e.g., "Smith" in "(Smith, 2020)") — those go in cited_sources. Empty array when nothing new appears.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string', enum: PERSON_ROLES, description: 'Best guess. Omit if unsure.' }
              },
              required: ['name']
            }
          },
          cited_sources: {
            type: 'array',
            description: 'EVERY citation in the passage — both full bibliography entries AND inline citations like "(Smith, 2020)" or "Smith and Jones (2018)". For inline citations without a title, leave title blank and put the authors+year in `authors`/`year`. NEVER fabricate a title. Each distinct citation gets its own entry.',
            items: {
              type: 'object',
              properties: {
                title:   { type: 'string', description: 'Real title if present in the passage. Leave EMPTY string for inline citations (do not invent or use placeholders).' },
                authors: { type: 'string', description: 'Author list as written (e.g., "Smith, J. & Doe, A." or "Creed, Fallon, & Hood").' },
                year:    { type: 'integer' },
                journal: { type: 'string', description: 'Journal, conference, or publisher — only if present.' },
                doi:     { type: 'string' }
              },
              required: ['authors']
            }
          }
        },
        required: ['summary', 'existing_concept_labels', 'new_concept_labels',
                   'existing_person_names', 'new_people', 'cited_sources']
      }
    }
  end

  def build_prompt
    truncated_passage = @passage.length > MAX_PASSAGE_CHARS ? @passage[0, MAX_PASSAGE_CHARS] + '…' : @passage

    source_block = if @source_title.present? || @source_abstract.present?
      <<~SRC
        SOURCE CONTEXT (for grounding only — do not summarize this):
        Title: #{@source_title.presence || '(unknown)'}
        Abstract: #{@source_abstract.presence || '(none)'}
      SRC
    else
      ''
    end

    concepts_block = if @user_concepts.any?
      labels = @user_concepts.first(MAX_CONCEPTS_IN_PROMPT).map { |c| "- #{c[:label]}" }.join("\n")
      <<~CON

        USER'S EXISTING CONCEPTS (match by meaning, copy label exactly):
        #{labels}
      CON
    else
      ''
    end

    people_block = if @user_people.any?
      names = @user_people.first(MAX_PEOPLE_IN_PROMPT).map { |p| "- #{p[:full_name]}" }.join("\n")
      <<~PPL

        USER'S EXISTING PEOPLE (match by name, copy exactly):
        #{names}
      PPL
    else
      ''
    end

    <<~PROMPT
      You are an academic research assistant helping the user take notes on a passage they highlighted in a PDF.

      #{source_block}#{concepts_block}#{people_block}
      PASSAGE:
      """
      #{truncated_passage}
      """

      Do four things:
      1. Write a 1-3 sentence summary that states the information DIRECTLY, as if you are presenting the facts.  NEVER start the summary with phrases like "This passage…", "The passage…", "The text…", "The article…", "The author…", "It describes…", "It explains…", or any other meta-reference to the source.  Examples:
         BAD:  "This passage describes career adaptability as the readiness to cope with work-related tasks."
         GOOD: "Career adaptability is the readiness to cope with work-related tasks and adjust to changing career plans, framed within goal-setting theory."
      2. Pick concept tags. CRITICAL: judge concepts ONLY from the passage text, NOT the source title/abstract. The source context is for disambiguation only. A concept counts ONLY if the passage's actual sentences address it — not because the larger article is about it. If the passage just sets up adjacent topics without engaging them, return nothing. It is correct and expected to return ZERO concepts when the passage is a transition, citation cluster, or framing sentence. Return at most 2-3 truly applicable tags.
      3. Identify named people DISCUSSED substantively in the passage (their work explained, views described). Authors who only appear in citations like "(Smith, 2020)" or "Creed et al., 2009" are NOT people — they belong in cited_sources.
      4. List EVERY distinct citation in the passage as a cited_sources entry. Include both full bibliography entries (with title) and inline citations (with empty title, just authors+year). Each unique work gets one entry. Don't merge multiple citations into one. NEVER fabricate a title — leave it blank if not present.
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "PassageInsightService API failed: #{response.code} #{response.body.to_s.truncate(300)}"
      return nil
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return nil unless tool_use

    input = tool_use['input'] || {}
    summary = input['summary'].to_s.strip

    {
      summary:            summary,
      suggested_concepts: build_concepts(input),
      suggested_people:   build_people(input),
      cited_sources:      build_citations(input)
    }
  rescue JSON::ParserError => e
    Rails.logger.error "PassageInsightService JSON parse error: #{e.message}"
    nil
  end

  def build_concepts(input)
    existing = Array(input['existing_concept_labels']).map(&:to_s).map(&:strip).reject(&:blank?)
    novel    = Array(input['new_concept_labels']).map(&:to_s).map(&:strip).reject(&:blank?)

    matched = existing.filter_map do |label|
      hit = @user_concepts.find { |c| c[:label].to_s.casecmp(label).zero? }
      hit ? { id: hit[:id], label: hit[:label] } : nil
    end

    matched_lc = matched.map { |c| c[:label].downcase }
    new_chips = novel.uniq { |l| l.downcase }
                     .reject { |l| matched_lc.include?(l.downcase) }
                     .first(3)
                     .map { |label| { id: nil, label: label } }

    matched + new_chips
  end

  def build_people(input)
    existing = Array(input['existing_person_names']).map(&:to_s).map(&:strip).reject(&:blank?)
    novel    = Array(input['new_people']).select { |p| p.is_a?(Hash) && p['name'].to_s.strip.length >= 2 }

    matched = existing.filter_map do |name|
      hit = @user_people.find { |p| p[:full_name].to_s.casecmp(name).zero? }
      hit ? { id: hit[:id], full_name: hit[:full_name] } : nil
    end

    matched_lc = matched.map { |p| p[:full_name].downcase }
    new_chips = novel.uniq { |p| p['name'].downcase.strip }
                     .reject { |p| matched_lc.include?(p['name'].downcase.strip) }
                     .first(5)
                     .map do |p|
                       row = { id: nil, full_name: p['name'].to_s.strip }
                       role = p['role'].to_s.downcase.strip
                       row[:role] = role if PERSON_ROLES.include?(role)
                       row
                     end

    matched + new_chips
  end

  # Placeholder titles Haiku sometimes invents — always reject these.
  PLACEHOLDER_TITLE_RE = /\A(<.*>|\[.*\]|unknown|untitled|n\/?a|tbd|placeholder|title\??)\z/i

  def build_citations(input)
    seen = Set.new
    Array(input['cited_sources'])
      .select { |s| s.is_a?(Hash) }
      .filter_map do |s|
        raw_title = s['title'].to_s.strip
        title = raw_title
        # Drop fabricated placeholder titles; keep the entry but blank the title.
        title = '' if title.match?(PLACEHOLDER_TITLE_RE) || title.match?(/[<>\[\]]/)

        authors = s['authors'].to_s.strip
        year = s['year'].is_a?(Integer) ? s['year'] : (s['year'].to_s[/\d{4}/]&.to_i)

        # Need either a real title (>= 8 chars) OR an authors string to be useful.
        next nil if title.length < 8 && authors.empty?

        # If no real title, synthesize one from the full author list so the
        # chip + Source row identifies the work uniquely.  Cleanup keeps
        # punctuation tidy — e.g. "Creed, Fallon, & Hood (2009)".
        if title.empty? || title.length < 8
          clean_authors = authors.gsub(/\s+/, ' ').strip.sub(/[,;]\s*$/, '')
          title = year ? "#{clean_authors} (#{year})" : clean_authors
        end

        # Dedupe by (authors, year) since inline cites may be repeated.
        key = [authors.downcase, year].join('|')
        next nil if seen.include?(key)
        seen << key

        {
          title:   title,
          authors: authors.presence,
          year:    year,
          journal: s['journal'].to_s.strip.presence,
          doi:     s['doi'].to_s.strip.presence
        }.compact
      end
      .first(10)
  end
end
