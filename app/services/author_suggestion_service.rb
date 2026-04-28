require 'net/http'
require 'json'

# Best-effort author proposer for the People "Magic" button.  Two-tier:
# 1. If we have a DOI, ask CrossRef — authoritative and free.
# 2. Otherwise, ask Haiku to extract authors from the title + abstract.
#    This works less often (most abstracts don't list authors), but is fine
#    for the common case where the abstract opens "We (Smith and Jones, 2024) ..."
#    or where the source already has its full citation in another form.
#
# Returns a uniform shape regardless of source:
#   [{ given:, family:, orcid: }, ...]
class AuthorSuggestionService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  def initialize(title:, abstract: nil, doi: nil)
    @title = title.to_s.strip
    @abstract = abstract.to_s.strip
    @doi = doi.to_s.strip
  end

  # Returns { authors: [...], source: 'crossref'|'haiku'|'none' }.
  # Never raises.
  def suggest
    if @doi.present?
      crossref = CrossrefDoiAuthorService.new(@doi).authors
      if crossref.present?
        return { authors: crossref, source: 'crossref' }
      end
    end

    haiku = haiku_authors
    return { authors: haiku, source: 'haiku' } if haiku.present?

    { authors: [], source: 'none' }
  rescue => e
    Rails.logger.error "AuthorSuggestionService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    { authors: [], source: 'none' }
  end

  private

  def haiku_authors
    return [] if @title.blank?
    return [] unless ENV['ANTHROPIC_API_KEY'].present?
    return [] if @abstract.blank? # Without an abstract Haiku has no signal to work from.

    response = call_anthropic
    parse_response(response)
  end

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
      max_tokens: 768,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: 'propose_authors' },
      messages: [{ role: 'user', content: build_prompt }]
    }.to_json

    http.request(request)
  end

  def tool_schema
    {
      name: 'propose_authors',
      description: 'Return the authors of this source, as best you can determine from the metadata.  Empty list is a perfectly valid answer when the abstract does not name any authors.',
      input_schema: {
        type: 'object',
        properties: {
          authors: {
            type: 'array',
            description: 'One entry per author.  Use only names you can verify from the metadata — do not invent.',
            items: {
              type: 'object',
              properties: {
                given:  { type: 'string', description: 'First and middle names.  Empty string if only initials are known.' },
                family: { type: 'string', description: 'Last name (required).' }
              },
              required: ['family']
            }
          }
        },
        required: ['authors']
      }
    }
  end

  def build_prompt
    <<~PROMPT
      You are extracting the author list of an academic source.

      Title: #{@title}
      Abstract: #{@abstract}

      If the abstract or title clearly names the authors of this paper, list them in order.
      If the abstract only references OTHER works (cited authors), do not return those.
      If you cannot find author names with reasonable confidence, return an empty list.
      Never invent or guess names.
    PROMPT
  end

  def parse_response(response)
    return [] unless response.is_a?(Net::HTTPSuccess)

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return [] unless tool_use

    Array(tool_use.dig('input', 'authors')).map do |a|
      family = a['family'].to_s.strip
      given  = a['given'].to_s.strip
      next nil if family.blank?
      { family: family, given: given.presence, orcid: nil }
    end.compact
  rescue JSON::ParserError => e
    Rails.logger.error "AuthorSuggestionService JSON parse error: #{e.message}"
    []
  end
end
