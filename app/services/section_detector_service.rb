require 'net/http'
require 'json'

# Asks Haiku to identify the section headings of a PDF (Methods, Results,
# Discussion, etc.) and the page each one starts on.  Used as a fallback
# when the PDF has no embedded outline (`getOutline()` returns empty).
#
# Cheap by design: per-page text is truncated and only the first MAX_PAGES
# pages are sent.  Tool-use forces the response shape.
class SectionDetectorService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  MAX_PAGES = 30
  MAX_CHARS_PER_PAGE = 1500

  def initialize(pdf_file)
    @pdf_file = pdf_file
  end

  # Returns Array<{ label:, page: }> sorted by page.  Empty array on any error.
  def call
    return [] unless ENV['ANTHROPIC_API_KEY'].present?

    tagged = page_tagged_text
    return [] if tagged.blank?

    response = call_anthropic(tagged)
    parse_response(response)
  rescue => e
    Rails.logger.error "SectionDetectorService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  private

  # Build a "[PAGE N]\n..." block per page so Haiku can tag sections by page.
  def page_tagged_text
    reader = pdf_reader
    return '' unless reader

    reader.pages.first(MAX_PAGES).each_with_index.map do |page, i|
      text = page.text.to_s.gsub(/[[:space:]]+/, ' ').strip
      truncated = text.length > MAX_CHARS_PER_PAGE ? text[0, MAX_CHARS_PER_PAGE] + '…' : text
      "[PAGE #{i + 1}]\n#{truncated}"
    end.join("\n\n")
  rescue => e
    Rails.logger.error "Per-page extract failed: #{e.message}"
    ''
  end

  def pdf_reader
    if @pdf_file.respond_to?(:path) && File.exist?(@pdf_file.path.to_s)
      PDF::Reader.new(@pdf_file.path)
    elsif @pdf_file.respond_to?(:read)
      @pdf_file.rewind if @pdf_file.respond_to?(:rewind)
      PDF::Reader.new(@pdf_file)
    end
  rescue => e
    Rails.logger.error "PDF::Reader open failed: #{e.message}"
    nil
  end

  def call_anthropic(text)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 45

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 700,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: 'record_sections' },
      messages: [
        { role: 'user', content: build_prompt(text) }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema
    {
      name: 'record_sections',
      description: 'Record the major section headings of the document and the page each begins on.',
      input_schema: {
        type: 'object',
        properties: {
          sections: {
            type: 'array',
            description: 'Top-level structural sections only (Abstract, Introduction, Methods, Results, Discussion, Limitations, References, etc). Skip subsections, captions, and headers/footers. Use the label as it appears in the document. Empty array if the document has no clear section structure.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Section name, in title case as printed.' },
                page:  { type: 'integer', description: 'Page number (1-indexed) where the section begins.' }
              },
              required: ['label', 'page']
            }
          }
        },
        required: ['sections']
      }
    }
  end

  def build_prompt(text)
    <<~PROMPT
      You are reading a PDF article and need to identify its major section headings.

      Each page is marked with a [PAGE N] tag.  Identify the major structural sections
      (Abstract, Introduction, Methods, Results, Discussion, Limitations, Conclusion,
      References, Acknowledgements, Appendix, etc.) and the page each begins on.

      Rules:
      - Top-level sections only.  Skip subsections like "2.1 Sample" or "Hypothesis 1".
      - Use the label as it appears in the document, in title case.
      - Skip running headers/footers, page numbers, captions, and figure/table titles.
      - If the document has no clear section structure (e.g., a short letter or a single-page abstract), return an empty array.

      DOCUMENT:
      #{text}
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "SectionDetector API failed: #{response.code} #{response.body.to_s.truncate(300)}"
      return []
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return [] unless tool_use

    Array(tool_use.dig('input', 'sections'))
      .filter_map do |s|
        next nil unless s.is_a?(Hash)
        label = s['label'].to_s.strip
        page = s['page']
        next nil if label.blank? || !page.is_a?(Integer) || page < 1
        { label: label, page: page }
      end
      .sort_by { |s| s[:page] }
  rescue JSON::ParserError => e
    Rails.logger.error "SectionDetector JSON parse error: #{e.message}"
    []
  end
end
