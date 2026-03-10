require 'net/http'
require 'json'

class ConceptSuggestionService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  def initialize(title:, abstract: nil, keywords: nil)
    @title = title
    @abstract = abstract
    @keywords = keywords || []
  end

  def suggest
    return [] if @title.blank?
    return [] unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic_api
    parse_response(response)
  rescue => e
    Rails.logger.error "ConceptSuggestionService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  private

  def call_anthropic_api
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
        {
          role: 'user',
          content: build_prompt
        }
      ]
    }.to_json

    http.request(request)
  end

  def build_prompt
    keywords_text = @keywords.any? ? @keywords.join(', ') : 'None provided'

    <<~PROMPT
      You are an academic research assistant. Analyze this article metadata and identify 5-8 key academic concepts.

      Title: #{@title}
      Abstract: #{@abstract || 'None provided'}
      Keywords: #{keywords_text}

      For each concept, provide:
      - label: Concept name (title case, typically 2-4 words)
      - node_type: One of [concept, theory, method, measure, entity, category, subject]
      - confidence: One of [high, medium, low]
      - rationale: Brief (10-15 words) explanation

      Guidelines for node_type:
      - concept: Theoretical constructs (Self-Efficacy, Cognitive Load)
      - theory: Named frameworks (Attachment Theory, Social Learning Theory)
      - method: Research methods (Meta-Analysis, Randomized Controlled Trial)
      - measure: Assessment tools (Beck Depression Inventory)
      - entity: Specific groups/orgs (Healthcare Workers, College Students)
      - category: Broad disciplines (Clinical Psychology)
      - subject: Topic areas (Workplace Stress, Early Childhood)

      Return ONLY a valid JSON array with no additional text or markdown formatting.
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "ConceptSuggestionService API failed: #{response.code}"
      return []
    end

    result = JSON.parse(response.body)
    text_content = result.dig('content', 0, 'text')

    return [] if text_content.blank?

    Rails.logger.info "ConceptSuggestionService response received, parsing..."

    # Extract JSON from response
    json_text = text_content.strip

    # If wrapped in markdown code blocks, extract content
    if json_text.match?(/```/)
      json_match = json_text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
      json_text = json_match[1] if json_match
    end

    # Find the JSON array
    json_start = json_text.index('[')
    json_end = json_text.rindex(']')

    if json_start && json_end && json_end > json_start
      json_text = json_text[json_start..json_end]
    end

    suggestions = JSON.parse(json_text)

    # Validate and normalize suggestions
    suggestions.select { |s| s['label'].present? }.map do |suggestion|
      {
        'label' => suggestion['label'].to_s.strip,
        'node_type' => normalize_node_type(suggestion['node_type']),
        'confidence' => normalize_confidence(suggestion['confidence']),
        'rationale' => suggestion['rationale'].to_s.strip
      }
    end
  rescue JSON::ParserError => e
    Rails.logger.error "ConceptSuggestionService JSON parse error: #{e.message}"
    []
  end

  def normalize_node_type(node_type)
    valid_types = %w[concept theory method measure entity category subject]
    type = node_type.to_s.downcase.strip
    valid_types.include?(type) ? type : 'subject'
  end

  def normalize_confidence(confidence)
    valid_levels = %w[high medium low]
    level = confidence.to_s.downcase.strip
    valid_levels.include?(level) ? level : 'medium'
  end
end
