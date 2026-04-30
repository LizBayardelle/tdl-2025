require 'net/http'
require 'json'

# Calls Haiku to identify statistical tests used in a paper, drawing only
# from the canonical StatisticalTest vocabulary in the DB.  Mirrors the
# pattern of ResearchTypeTagger — tool-use with an enum-constrained schema
# so the model can only return real test names.
#
# Cheap by design: we send title + abstract + (optionally summary) only.
# PDF text is intentionally not included.
#
# Returns Array<StatisticalTest> on success, [] on any error.  Never
# raises.  Aliases are resolved via StatisticalTest.find_by_name_or_alias.
class StatisticalTestTagger
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL             = 'claude-haiku-4-5-20251001'

  # PDF text budget — keeps a single call well under any practical token
  # limit. The Methods/Results sections that name tests are usually in the
  # first ~30K characters anyway.
  PDF_TEXT_BUDGET = 30_000

  def initialize(title:, abstract: nil, summary: nil, kind: nil, pdf_text: nil)
    @title    = title.to_s.strip
    @abstract = abstract.to_s.strip
    @summary  = summary.to_s.strip
    @kind     = kind.to_s.strip
    @pdf_text = pdf_text.to_s
  end

  # Returns Array<StatisticalTest>.  Empty array on any error or when the
  # abstract has no clear statistical signal.
  def tag
    return [] if @title.blank?
    return [] unless ENV['ANTHROPIC_API_KEY'].present?

    vocab = canonical_names
    return [] if vocab.empty?

    response = call_anthropic(vocab)
    parse_response(response)
  rescue => e
    Rails.logger.error "StatisticalTestTagger error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  private

  # Pull canonical names + aliases from the DB.  Cached for the duration
  # of the request — vocab rarely changes.
  def canonical_names
    @canonical_names ||= StatisticalTest.pluck(:name).compact
  end

  def call_anthropic(vocab)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 30

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type']      = 'application/json'
    request['x-api-key']         = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 512,
      tools: [tool_schema(vocab)],
      tool_choice: { type: 'tool', name: 'tag_statistical_tests' },
      messages: [
        { role: 'user', content: build_prompt }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema(vocab)
    {
      name: 'tag_statistical_tests',
      description: 'Return the statistical tests that the paper appears to use, drawn ONLY from the controlled vocabulary.',
      input_schema: {
        type: 'object',
        properties: {
          tests: {
            type: 'array',
            description: 'One or more test names from the controlled vocabulary.  Only include tests the abstract clearly describes the authors using.  Empty array if nothing is identifiable from the abstract alone.',
            items: { type: 'string', enum: vocab }
          }
        },
        required: ['tests']
      }
    }
  end

  def build_prompt
    body = @abstract.presence || @summary.presence || '(no abstract available)'
    kind_line = @kind.present? ? "Source Type: #{@kind}\n" : ''
    pdf_block = if @pdf_text.present?
      excerpt = @pdf_text[0, PDF_TEXT_BUDGET]
      "\n\nFull-text excerpt (Methods/Results often appear here):\n---\n#{excerpt}\n---\n"
    else
      ''
    end

    <<~PROMPT
      You are an academic research assistant identifying which statistical tests a paper uses.

      Title: #{@title}
      #{kind_line}Abstract: #{body}#{pdf_block}
      Identify the specific statistical tests the authors describe using.  Pick conservatively —
      better to return one test you can clearly identify than several speculative guesses.
      Multiple tests are appropriate when the paper genuinely combines methods (e.g., a t-test
      for between-group comparison plus a regression for adjustment).

      Return an empty array if the source is too vague to identify any specific test, or
      if it is clearly a non-empirical piece (review, theoretical, qualitative).
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "StatisticalTestTagger API failed: #{response.code} #{response.body.to_s.truncate(300)}"
      return []
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return [] unless tool_use

    names = Array(tool_use.dig('input', 'tests'))
    names.map { |n| StatisticalTest.find_by_name_or_alias(n) }.compact.uniq
  rescue JSON::ParserError => e
    Rails.logger.error "StatisticalTestTagger JSON parse error: #{e.message}"
    []
  end
end
