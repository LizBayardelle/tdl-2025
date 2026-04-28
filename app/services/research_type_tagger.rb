require 'net/http'
require 'json'

# Calls Haiku to classify a source's methodology against a fixed vocabulary.
# Uses tool-use with an enum-constrained schema so the model can only return
# values from RESEARCH_TYPES — no rogue strings, no parsing risk.
#
# Cheap by design: we send title + abstract only.  When the abstract is
# missing we fall back to summary.  PDF text is intentionally not sent —
# the abstract is sufficient for methodology classification and saves
# ~95% of tokens on a typical paper.
class ResearchTypeTagger
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  # Mirrors the RESEARCH_TYPES list in app/javascript/components/SourceFormModal.js.
  # Keep these two in sync.
  RESEARCH_TYPES = [
    'Case Study', 'Cohort Study', 'Computational Modeling', 'Cross-sectional',
    'Experimental', 'Literature Review', 'Longitudinal', 'Meta-analysis',
    'Mixed Methods', 'Natural Experiment', 'Observational', 'Pilot Study',
    'Predictive Modeling', 'Psychometrics', 'Qualitative', 'Quantitative',
    'Quasi-experimental', 'RCT', 'Replication Study', 'Secondary Data Analysis',
    'Systematic Review', 'Theoretical Paper'
  ].freeze

  def initialize(title:, abstract: nil, summary: nil, kind: nil)
    @title = title.to_s.strip
    @abstract = abstract.to_s.strip
    @summary = summary.to_s.strip
    @kind = kind.to_s.strip
  end

  # Returns an Array<String> of methodology labels drawn from RESEARCH_TYPES,
  # or an empty array on any error.  Never raises.
  def tag
    return [] if @title.blank?
    return [] unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic
    parse_response(response)
  rescue => e
    Rails.logger.error "ResearchTypeTagger error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
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
      max_tokens: 512,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: 'tag_research_types' },
      messages: [
        { role: 'user', content: build_prompt }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema
    {
      name: 'tag_research_types',
      description: 'Return the research methodology tags that apply to this source, drawn ONLY from the controlled vocabulary.',
      input_schema: {
        type: 'object',
        properties: {
          types: {
            type: 'array',
            description: 'One or more methodology labels from the controlled vocabulary.  Only include tags that clearly apply.  Empty array if nothing applies confidently.',
            items: { type: 'string', enum: RESEARCH_TYPES }
          }
        },
        required: ['types']
      }
    }
  end

  def build_prompt
    body = @abstract.presence || @summary.presence || '(no abstract available)'
    kind_line = @kind.present? ? "Source Type: #{@kind}\n" : ''

    <<~PROMPT
      You are an academic research assistant classifying the methodology of a paper.

      Title: #{@title}
      #{kind_line}Abstract: #{body}

      Identify the research methodology tags that clearly apply to this source.
      Pick conservatively — better to return one accurate tag than three speculative ones.
      Multiple tags are appropriate when the source genuinely combines methods (e.g., Mixed Methods + Longitudinal).
      Return an empty array if the abstract is too vague to classify confidently.
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "ResearchTypeTagger API failed: #{response.code} #{response.body.to_s.truncate(300)}"
      return []
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return [] unless tool_use

    types = Array(tool_use.dig('input', 'types'))
    types.select { |t| RESEARCH_TYPES.include?(t) }
  rescue JSON::ParserError => e
    Rails.logger.error "ResearchTypeTagger JSON parse error: #{e.message}"
    []
  end
end
