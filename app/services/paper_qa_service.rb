require 'net/http'
require 'json'

# Asks Haiku a question about a PDF.  Strict by design: every answer must
# include a literal supporting quote that we VERIFY appears in the source
# text.  If the model returns confidence: cannot_answer OR if the quote
# can't be verified, we surface "I couldn't find that in this paper" rather
# than risk hallucinated citations.
#
# Cheap-ish: caps PDF pages and per-page chars sent to the model, similar
# to SectionDetectorService.
class PaperQaService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  MAX_PAGES = 60
  MAX_CHARS_PER_PAGE = 3000
  MAX_QUESTION_CHARS = 500

  CONFIDENCE_LEVELS = %w[high medium low cannot_answer].freeze

  def initialize(pdf_file:, question:)
    @pdf_file = pdf_file
    @question = question.to_s.strip
  end

  # Returns: { answer:, supporting_quote:, page_number:, confidence: } or nil on hard error.
  # If the model says cannot_answer OR if the quote can't be verified in the
  # PDF text, returns a normalized cannot_answer response.
  def call
    return cannot_answer('No question provided.') if @question.blank?
    return cannot_answer('Question is too long — try a shorter version.') if @question.length > MAX_QUESTION_CHARS
    return cannot_answer('No PDF text available to read.') unless @pdf_file
    return cannot_answer('AI is not configured.') unless ENV['ANTHROPIC_API_KEY'].present?

    @page_texts = extract_page_texts
    return cannot_answer('Could not read the PDF text.') if @page_texts.empty?

    response = call_anthropic
    parse_and_verify(response)
  rescue => e
    Rails.logger.error "PaperQaService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    cannot_answer('Something went wrong reading the paper. Try again.')
  end

  private

  def cannot_answer(message)
    {
      answer: message,
      supporting_quote: nil,
      page_number: nil,
      confidence: 'cannot_answer'
    }
  end

  # Returns Array<String> indexed by page_number-1.  Trimmed/normalized.
  def extract_page_texts
    reader = pdf_reader
    return [] unless reader

    reader.pages.first(MAX_PAGES).map do |page|
      page.text.to_s.gsub(/[[:space:]]+/, ' ').strip
    end
  rescue => e
    Rails.logger.error "Per-page extract failed: #{e.message}"
    []
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

  def page_tagged_text
    @page_texts.each_with_index.map do |text, i|
      truncated = text.length > MAX_CHARS_PER_PAGE ? text[0, MAX_CHARS_PER_PAGE] + '…' : text
      "[PAGE #{i + 1}]\n#{truncated}"
    end.join("\n\n")
  end

  def call_anthropic
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 60

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 700,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: 'answer_question_about_paper' },
      messages: [
        { role: 'user', content: build_prompt }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema
    {
      name: 'answer_question_about_paper',
      description: 'Answer a question about a research paper.  ALWAYS include a literal supporting quote from the paper.  If the answer is not in the paper, set confidence to cannot_answer and explain what was missing.',
      input_schema: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'A direct, plain-language answer to the question, OR (if cannot_answer) an honest one-sentence explanation of what the paper does NOT cover.'
          },
          supporting_quote: {
            type: 'string',
            description: 'A SHORT literal quote (under 300 chars) from the paper that supports the answer.  Copy the text EXACTLY as it appears, including punctuation.  If you cannot answer from the paper, leave this empty.'
          },
          page_number: {
            type: 'integer',
            description: 'The page number where the supporting quote appears (1-indexed).  Use the [PAGE N] tag from the document.  Omit when cannot_answer.'
          },
          confidence: {
            type: 'string',
            enum: CONFIDENCE_LEVELS,
            description: 'high = quote directly answers the question; medium = supports a clear inference; low = related but partial; cannot_answer = the paper does not contain the answer.'
          }
        },
        required: ['answer', 'confidence']
      }
    }
  end

  def build_prompt
    <<~PROMPT
      You are answering a question about a research paper.  The paper's text is below, with each page marked by a [PAGE N] tag.

      RULES:
      1. Answer ONLY from the paper text.  Do NOT use outside knowledge.
      2. Every answer (other than cannot_answer) MUST include a literal supporting_quote copied EXACTLY from the paper, plus the page_number where it appears.
      3. If the question asks for something the paper genuinely does not address, set confidence to "cannot_answer" and briefly state what is missing.  Do NOT guess.  Do NOT make up quotes.
      4. Keep the answer concise — one or two sentences.

      QUESTION:
      #{@question}

      PAPER:
      #{page_tagged_text}
    PROMPT
  end

  # Verify the supporting_quote actually appears in the cited page (and a
  # neighbouring page, in case the model misnumbered).  If it doesn't, force
  # cannot_answer to keep us honest.
  def parse_and_verify(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "PaperQa API failed: #{response.code} #{response.body.to_s.truncate(300)}"
      return cannot_answer('AI service unavailable. Try again in a moment.')
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return cannot_answer('No answer returned.') unless tool_use

    input = tool_use['input'] || {}
    answer = input['answer'].to_s.strip
    quote = input['supporting_quote'].to_s.strip
    page = input['page_number'].is_a?(Integer) ? input['page_number'] : nil
    confidence = CONFIDENCE_LEVELS.include?(input['confidence']) ? input['confidence'] : 'low'

    return cannot_answer(answer.presence || 'The paper does not appear to address that.') if confidence == 'cannot_answer'
    return cannot_answer('No answer returned.') if answer.blank?
    return cannot_answer("The model didn't anchor its answer in a quote — refusing to guess.") if quote.blank? || page.nil?

    if quote_verified?(quote, page)
      { answer: answer, supporting_quote: quote, page_number: page, confidence: confidence }
    else
      Rails.logger.warn "PaperQa quote not verified on p.#{page}: #{quote.truncate(80).inspect}"
      cannot_answer("The model's quote couldn't be verified in the paper. Refusing to guess.")
    end
  rescue JSON::ParserError => e
    Rails.logger.error "PaperQa JSON parse error: #{e.message}"
    cannot_answer('Something went wrong reading the response. Try again.')
  end

  # Quote verification: aggressively normalize both the quote and the
  # candidate page text(s), then attempt three matches in order of strictness.
  # PDF::Reader output is messy (ligatures, soft hyphens, line breaks
  # mid-word), and Haiku often truncates quotes with "..." — both sides need
  # forgiveness.
  def quote_verified?(quote, page)
    return false unless page.between?(1, @page_texts.length)

    cleaned = strip_ellipses(quote.to_s)
    needle = normalize(cleaned)
    return false if needle.length < 10

    # ±2 pages — Haiku occasionally misnumbers when columns or front matter
    # shift the visual page count vs. the [PAGE N] tag.
    candidates = [page, page - 1, page + 1, page - 2, page + 2]
      .select { |p| p.between?(1, @page_texts.length) }
      .map    { |p| normalize(@page_texts[p - 1]) }

    # 1) Whole-quote substring
    return true if candidates.any? { |h| h.include?(needle) }

    # 2) Prefix match: first 60 normalized chars (handles model truncation
    #    or trailing edits we couldn't fully strip)
    prefix = needle[0, 60]
    return true if prefix.length >= 30 && candidates.any? { |h| h.include?(prefix) }

    # 3) Last-resort fuzzy: first 5 distinctive words appear in order with
    #    up to two filler words between (catches re-flowed columns / footers)
    words = needle.split.reject { |w| w.length < 4 }
    if words.length >= 5
      pattern = Regexp.new(words.first(5).map { |w| Regexp.escape(w) }.join('\\s+(?:\\S+\\s+){0,2}'))
      return true if candidates.any? { |h| h.match?(pattern) }
    end

    false
  end

  def strip_ellipses(s)
    s.to_s
      .sub(/\s*[\.…]{2,}\s*\z/, '')   # trailing "..." or "…"
      .sub(/\A\s*[\.…]{2,}\s*/, '')   # leading "..."
      .gsub(/\[\s*[\.…]+\s*\]/, ' ')  # interior [...]
      .strip
  end

  LIGATURES = {
    "\uFB00" => 'ff', "\uFB01" => 'fi', "\uFB02" => 'fl',
    "\uFB03" => 'ffi', "\uFB04" => 'ffl', "\uFB05" => 'st', "\uFB06" => 'st',
  }.freeze

  def normalize(s)
    s.to_s
      .gsub(/[\uFB00-\uFB06]/) { |c| LIGATURES[c] || c }      # ligatures
      .gsub(/\u00AD/, '')                                       # soft hyphen
      .gsub(/\u00A0/, ' ')                                      # non-breaking space
      .gsub(/[\u2018\u2019\u201A\u201B\u2032]/, "'")            # smart single quotes
      .gsub(/[\u201C\u201D\u201E\u201F\u2033]/, '"')            # smart double quotes
      .gsub(/[\u2010\u2011\u2012\u2013\u2014\u2015]/, '-')      # dashes
      .gsub(/(\w)-\s+(\w)/, '\1\2')                             # join hyphenated line breaks
      .gsub(/[[:space:]]+/, ' ')
      .downcase
      .strip
  end
end
