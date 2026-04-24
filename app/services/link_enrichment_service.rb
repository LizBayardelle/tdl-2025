require 'uri'
require 'net/http'
require 'json'
require 'cgi'

# Stage 3: find definitional / reference pages for a concept.
#
# Uses a dedicated Claude Haiku 4.5 call with web_search restricted to the
# AllowedDomain whitelist. The prompt explicitly asks for the kind of
# overview pages a reader clicking "learn more" actually wants
# (Wikipedia, disease/condition pages, textbook chapters, fact sheets)
# and warns off specific research papers, adjacent topics, and data tables.
#
# Then layers a safety-net Wikipedia lookup on top to guarantee that — if
# the concept has a canonical Wikipedia article — it's always present even
# if Claude didn't surface it.
class LinkEnrichmentService
  class EnrichmentError < StandardError; end

  MODEL = 'claude-haiku-4-5'
  MAX_TOKENS = 2_000
  MAX_SEARCHES = 4

  WIKIPEDIA_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/'.freeze
  WIKIPEDIA_TIMEOUT = 4

  # Last-resort URL filter for obviously non-article content. The Haiku
  # prompt already warns off these; this is belt-and-suspenders.
  NON_ARTICLE_URL_PATTERNS = [
    /\.pdf\z/i,
    %r{/(table|tables|figure|figures|supp(lement(ary)?)?|appendix|data|references|citation|cited-by)/}i
  ].freeze

  # Domain → display category. Ordered longest-first so suffix lookups
  # land on the most specific match (e.g. pubmed before ncbi before nih).
  DOMAIN_CATEGORIES = {
    'pubmed.ncbi.nlm.nih.gov' => 'PubMed',
    'health.harvard.edu'      => 'Harvard Health',
    'nimh.nih.gov'            => 'NIMH',
    'ninds.nih.gov'           => 'NINDS',
    'nia.nih.gov'             => 'NIA',
    'my.clevelandclinic.org'  => 'Cleveland Clinic',
    'mayoclinic.org'          => 'Mayo Clinic',
    'mentalhealth.va.gov'     => 'VA Mental Health',
    'psychiatry.org'          => 'APA (Psychiatry)',
    'psychologytoday.com'     => 'Psychology Today',
    'sciencedirect.com'       => 'ScienceDirect',
    'apa.org'                 => 'APA (Psychology)',
    'samhsa.gov'              => 'SAMHSA',
    'adaa.org'                => 'ADAA',
    'who.int'                 => 'WHO',
    'nih.gov'                 => 'NIH / NCBI',
    'wikipedia.org'           => 'Wikipedia',
    'merriam-webster.com'     => 'Merriam-Webster'
  }.freeze

  def initialize(concept_generation:, skip_wikipedia_lookup: false, client: nil, logger: Rails.logger)
    @generation = concept_generation
    @skip_wikipedia_lookup = skip_wikipedia_lookup
    @logger = logger
    @client = client || AnthropicStreamingClient.new(logger: logger)
  end

  def call
    links = call_claude_for_links
    ensure_canonical_wikipedia_entry(links)
  end

  private

  def call_claude_for_links
    result = @client.call(build_request_body, user_message_text: user_message_text)
    parse_and_normalize(result[:content_blocks])
  rescue AnthropicStreamingClient::MissingApiKey,
         AnthropicStreamingClient::ApiError,
         JSON::ParserError => e
    @logger.warn "LinkEnrichmentService: #{e.class} (#{e.message}); returning Wikipedia-only"
    []
  end

  def build_request_body
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
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
      allowed_domains: allowed_domains,
      # Haiku 4.5 doesn't support dynamic filtering via code_execution,
      # so disable the programmatic-caller path and use direct search.
      allowed_callers: ['direct']
    }
  end

  def allowed_domains
    @allowed_domains ||= AllowedDomain.active_domains
  end

  # Accept a URL only if its canonical domain matches an active whitelist
  # entry (exact match or proper suffix). Catches Haiku hallucinations
  # like `mayo.clinic.org` (real domain is `mayoclinic.org`).
  def on_allowed_domain?(domain)
    return false if domain.blank?

    allowed_domains.any? do |allowed|
      domain == allowed || domain.end_with?(".#{allowed}")
    end
  end

  def user_message_text
    parts = [%(Find the top 5-8 definitional / overview / reference pages for this concept: "#{@generation.concept_name}")]
    parts << "concept_type: #{@generation.concept_type}" if @generation.concept_type.present?
    parts << "Return JSON in the schema described by the system prompt."
    parts.join("\n\n")
  end

  # Byte-stable for prompt caching.
  def system_prompt
    <<~PROMPT
      You find definitional and reference pages about named concepts. The caller gives you a concept name; you return 5-8 high-quality URLs from the allowed-domain whitelist that a reader would want if they clicked "learn more about this concept."

      ## What to return

      Pages that DEFINE the concept itself, in rough preference order:

      1. The Wikipedia article for the concept (not adjacent articles).
      2. Disease / condition / anatomy / topic overview pages from authoritative medical and mental-health sites (Cleveland Clinic, Mayo Clinic, Harvard Health, NIMH, NINDS, NIA, SAMHSA, ADAA, WHO fact sheets).
      3. Textbook chapters (StatPearls via NCBI Bookshelf).
      4. Topic overview pages from ScienceDirect (`/topics/...`).
      5. Patient-facing reference pages from professional societies (APA Psychology, APA Psychiatry).
      6. Psychology Today overview articles (only if authoritative overview; skip opinion / blog posts).
      7. Merriam-Webster for etymology if relevant.

      ## What to AVOID

      - Specific primary research papers (pubmed.ncbi.nlm.nih.gov/NNNN, pmc.ncbi.nlm.nih.gov/articles/, sciencedirect.com/science/article/).
      - Data tables, figures, supplementary material (URLs containing /table/, /figure/, /data/, /supp/).
      - PDFs (usually research papers).
      - Adjacent / parent / child topics that aren't the concept itself. For "Anxiety", reject pages that are really about "Mental disorders", "Amygdala", "DSM-5", or specific anxiety subtypes unless the concept is that subtype.
      - Dated terminology. For "Anxiety", skip "Anxiety Neurosis".
      - News articles, press releases, opinion pieces.

      ## Search strategy

      Use web_search (restricted to the allowed domains). You have at most #{MAX_SEARCHES} searches — plan them carefully. Good first queries include:
      - `"{concept} overview"`, `"{concept} definition"`
      - `"{concept} Cleveland Clinic"`, `"{concept} NIMH"`, `"{concept} StatPearls"`, `"{concept} Wikipedia"`

      Typically 2-3 searches is plenty.

      ## Output

      Return a single JSON object wrapped in a fenced ```json block:

      ```json
      {
        "links": [
          {
            "url": "https://en.wikipedia.org/wiki/Anxiety",
            "name": "Anxiety — Wikipedia",
            "description": "General encyclopedic overview of anxiety: physiology, psychology, and disorders."
          },
          {
            "url": "https://www.nimh.nih.gov/health/topics/anxiety-disorders",
            "name": "Anxiety Disorders — NIMH",
            "description": "NIMH overview of anxiety disorders, symptoms, and treatments."
          }
        ]
      }
      ```

      5-8 entries total. Aim for domain diversity (don't return 4 Cleveland Clinic pages). Each entry: `url` (full https), `name` (the page title), `description` (one short sentence summarizing what the page covers). Category will be assigned by the caller from the URL domain.

      CRITICAL JSON FORMATTING: Use `\\n` escape sequences for any newlines inside string values — never a literal newline character. Strings must be single-line in the source JSON.
    PROMPT
  end

  def parse_and_normalize(content_blocks)
    json_text = extract_json_text(content_blocks)
    return [] if json_text.blank?

    parsed = JSON.parse(json_text)
    return [] unless parsed.is_a?(Hash)

    entries = parsed['links']
    return [] unless entries.is_a?(Array)

    entries
      .map { |e| normalize_entry(e) }
      .compact
      .reject { |e| non_article?(e['url']) }
      .reject { |e| !on_allowed_domain?(e['domain']) }
      .uniq { |e| e['url'] }
  end

  def normalize_entry(raw)
    return nil unless raw.is_a?(Hash)

    url = canonicalize_url(raw['url'].to_s.strip)
    return nil if url.blank?

    domain = extract_domain(url)
    return nil if domain.blank?

    category = category_for(domain)

    {
      'url' => url,
      'name' => raw['name'].to_s.strip.presence || url,
      'description' => raw['description'].to_s.strip.presence || category,
      'category' => category,
      'domain' => domain
    }
  rescue URI::InvalidURIError
    nil
  end

  def non_article?(url)
    NON_ARTICLE_URL_PATTERNS.any? { |p| url.to_s.match?(p) }
  end

  def canonicalize_url(url)
    return nil if url.blank?

    uri = URI.parse(url)
    return nil unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)

    host = uri.host.to_s.downcase.sub(/\Awww\./, '')
    path = uri.path.to_s
    path = path.sub(%r{/+\z}, '') unless path == '/'

    canonical = "#{uri.scheme}://#{host}#{path}"
    canonical += "?#{uri.query}" if uri.query.present? && !tracking_query?(uri.query)
    canonical
  rescue URI::InvalidURIError
    nil
  end

  def tracking_query?(query)
    params = query.split('&').map { |p| p.split('=', 2).first }
    (params - %w[utm_source utm_medium utm_campaign utm_term utm_content fbclid gclid ref]).empty?
  end

  def extract_domain(url)
    URI.parse(url).host.to_s.downcase.sub(/\Awww\./, '')
  rescue URI::InvalidURIError
    nil
  end

  def category_for(domain)
    return DOMAIN_CATEGORIES[domain] if DOMAIN_CATEGORIES.key?(domain)

    DOMAIN_CATEGORIES.each do |suffix, label|
      return label if domain.end_with?(".#{suffix}") || domain == suffix
    end

    domain # fallback: use the raw domain as category
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

  # If the concept has a canonical Wikipedia article, ensure it's in the
  # final list — either because Haiku already picked it up, or by fetching
  # it directly from Wikipedia's summary API.
  def ensure_canonical_wikipedia_entry(links)
    return links if @skip_wikipedia_lookup

    wiki = lookup_wikipedia(@generation.concept_name)
    return links if wiki.nil?

    canonical = canonicalize_url(wiki[:url])
    return links if canonical.blank?
    return links if links.any? { |l| l['url'] == canonical }

    entry = {
      'url' => canonical,
      'name' => wiki[:title].present? ? "#{wiki[:title]} — Wikipedia" : "#{@generation.concept_name} — Wikipedia",
      'description' => wiki[:extract].to_s.truncate(240).presence || 'Wikipedia overview',
      'category' => 'Wikipedia',
      'domain' => 'en.wikipedia.org'
    }

    [entry] + links
  end

  def lookup_wikipedia(name)
    return nil if name.blank?

    title = name.strip.tr(' ', '_')
    uri = URI("#{WIKIPEDIA_SUMMARY_URL}#{CGI.escape(title)}")

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = WIKIPEDIA_TIMEOUT
    http.read_timeout = WIKIPEDIA_TIMEOUT

    request = Net::HTTP::Get.new(uri.request_uri)
    request['User-Agent'] = 'tdl-concept-generator/1.0 (link enrichment)'
    request['Accept'] = 'application/json'

    response = http.request(request)
    return nil unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    return nil if data['type'] == 'disambiguation'

    url = data.dig('content_urls', 'desktop', 'page') || data.dig('content_urls', 'mobile', 'page')
    return nil if url.blank?

    { url: url, title: data['title'], extract: data['extract'] }
  rescue => e
    @logger.warn "LinkEnrichmentService: Wikipedia lookup failed for #{name.inspect}: #{e.class} #{e.message}"
    nil
  end
end
