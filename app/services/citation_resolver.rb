require 'net/http'
require 'json'
require 'digest'

# Resolves a free-form citation fragment ("Smith et al. 2021 attention is all
# you need", "10.1038/s41586-020-2649-2", "(Vaswani et al., 2017)", a partial
# title, etc.) to a real bibliographic record.
#
# Pipeline:
#   1. Short-circuits — DOI / arXiv / PMID regexes bypass everything
#   2. Haiku parse — extract { authors, year, title_fragment, journal_hint }
#   3. Crossref search — top 5 candidates from api.crossref.org
#   4. Haiku disambiguation — pick best when >1 plausible
#   5. OpenAlex enrichment — abstract + concept tags via DOI lookup
#
# Returns the same field shape ArticleMetadataExtractor returns so the
# frontend can plug results into the existing setFormData merge flow.
#
# Never raises.  Failures yield { ok: false, error: ... }.
class CitationResolver
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  CROSSREF_API      = 'https://api.crossref.org/works'
  OPENALEX_API      = 'https://api.openalex.org/works'
  MODEL             = 'claude-haiku-4-5-20251001'
  USER_AGENT        = 'MapMyResearch/1.0 (mailto:elizabeth@linchpinindustries.com)'
  CACHE_TTL         = 30.days

  DOI_REGEX   = %r{(10\.\d{4,9}/[\w\.\-/();:]+)}i
  ARXIV_REGEX = /\barxiv:\s*(\d{4}\.\d{4,5})(v\d+)?\b/i
  PMID_REGEX  = /\bpmid[:\s]+(\d{6,9})\b|\bpubmed[:\s]+(\d{6,9})\b/i

  def self.resolve(fragment)
    new(fragment).resolve
  end

  def initialize(fragment)
    @fragment = fragment.to_s.strip
  end

  def resolve
    return error('Empty input.') if @fragment.length < 4

    # Cache successful lookups for 30 days; errors are not cached so
    # transient failures (network, rate limit) can be retried.
    cached = Rails.cache.read(cache_key)
    return cached if cached.is_a?(Hash) && cached[:ok]

    result = do_resolve
    Rails.cache.write(cache_key, result, expires_in: CACHE_TTL) if result[:ok]
    result
  rescue => e
    Rails.logger.error "CitationResolver fatal: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    error('Lookup failed unexpectedly.')
  end

  private

  def cache_key
    "citation_resolver:v1:#{Digest::SHA256.hexdigest(@fragment.downcase)}"
  end

  def do_resolve
    if (doi = extract_doi)
      Rails.logger.info "CitationResolver: DOI short-circuit (#{doi})"
      candidate = fetch_by_doi(doi)
      return candidate ? success(candidate, [], 'high') : error('DOI not found in Crossref.')
    end

    if (arxiv = extract_arxiv)
      Rails.logger.info "CitationResolver: arXiv short-circuit (#{arxiv})"
      candidate = fetch_arxiv(arxiv)
      return candidate ? success(candidate, [], 'high') : error('arXiv lookup failed.')
    end

    if (pmid = extract_pmid)
      Rails.logger.info "CitationResolver: PMID short-circuit (#{pmid})"
      candidate = fetch_pubmed(pmid)
      return candidate ? success(candidate, [], 'high') : error('PubMed lookup failed.')
    end

    return error('Anthropic API key not configured.') if ENV['ANTHROPIC_API_KEY'].blank?

    query = parse_with_haiku
    return error('Could not parse the fragment into a search query.') if query.nil? || query.empty?

    candidates = search_crossref(query)
    return error('No matches in Crossref.  Try adding more detail.') if candidates.empty?

    sparse_query = query['title_fragment'].to_s.strip.empty? &&
                   query['journal_hint'].to_s.strip.empty?

    best, confidence = if candidates.size == 1
      [candidates.first, 'medium']
    else
      disambiguate_with_haiku(candidates, sparse_query: sparse_query)
    end

    # Safety net: when the user gave us only author+year (no topic, no
    # journal), Haiku has nothing real to disambiguate on — force "low"
    # so the user picks from the candidate list rather than us guessing.
    confidence = 'low' if sparse_query && candidates.size > 1

    enriched = enrich_with_openalex(best)
    enriched = fill_gaps_with_extractor(enriched) if enriched[:abstract].blank? && enriched[:doi].present?
    # When confidence is low, show many alternatives so the right paper
    # has a fighting chance of appearing in the picker.
    alt_cap = confidence == 'low' ? 24 : 5
    alternatives = candidates.reject { |c| c[:doi] == enriched[:doi] }.first(alt_cap)

    success(enriched, alternatives, confidence)
  end

  # =====================================================================
  # Short-circuits
  # =====================================================================

  def extract_doi
    m = @fragment.match(DOI_REGEX)
    m && m[1].sub(/[.,;:)\]\s]+\z/, '')
  end

  def extract_arxiv
    m = @fragment.match(ARXIV_REGEX)
    m && m[1]
  end

  def extract_pmid
    m = @fragment.match(PMID_REGEX)
    m && (m[1] || m[2])
  end

  def fetch_by_doi(doi)
    res = http_get("#{CROSSREF_API}/#{URI.encode_www_form_component(doi)}")
    return nil unless res.is_a?(Net::HTTPSuccess)
    item = JSON.parse(res.body).dig('message')
    return nil unless item
    map_crossref_item(item)
  end

  def fetch_arxiv(arxiv_id)
    # arXiv has its own atom-feed API; for v1 we lean on the fact that
    # arXiv DOIs follow the pattern 10.48550/arXiv.<id>.  Crossref indexes
    # arXiv preprints under that DOI.
    fetch_by_doi("10.48550/arXiv.#{arxiv_id}")
  end

  def fetch_pubmed(_pmid)
    # PubMed E-utilities is its own request flow with different fields.
    # Punt to v2 — for now, fall through to the AI/Crossref flow.
    nil
  end

  # =====================================================================
  # Stage 2: Haiku parse
  # =====================================================================

  def parse_with_haiku
    body = {
      model: MODEL,
      max_tokens: 512,
      tools: [parse_tool_schema],
      tool_choice: { type: 'tool', name: 'parse_citation' },
      messages: [{ role: 'user', content: parse_prompt }]
    }
    res = call_anthropic(body)
    return nil unless res.is_a?(Net::HTTPSuccess)

    parsed = JSON.parse(res.body)
    tool_use = Array(parsed['content']).find { |b| b['type'] == 'tool_use' }
    tool_use&.dig('input')
  rescue JSON::ParserError
    nil
  end

  def parse_tool_schema
    {
      name: 'parse_citation',
      description: 'Extract structured search fields from a free-form citation fragment.',
      input_schema: {
        type: 'object',
        properties: {
          authors: {
            type: 'array',
            description: 'Author last names actually present in the fragment, in order.  E.g., "Smith et al. 2021" → ["Smith"].  IMPORTANT: Return an empty array [] if no author surnames appear.  Never insert placeholder values like "Unknown", "Anonymous", "<UNKNOWN>", or "N/A" — empty array is the correct signal for "no authors mentioned".',
            items: { type: 'string' }
          },
          year: {
            type: 'integer',
            description: 'Publication year if mentioned.  Omit if absent.'
          },
          title_fragment: {
            type: 'string',
            description: 'Title or partial title text from the fragment.  Omit if no title text is present.'
          },
          journal_hint: {
            type: 'string',
            description: 'Journal or venue name hinted at, if any.  Omit otherwise.'
          }
        },
        required: ['authors']
      }
    }
  end

  def parse_prompt
    <<~PROMPT
      You are parsing a free-form citation fragment into structured search fields.

      The user may have provided an in-text citation ("Smith et al., 2021"), a
      partial title, a messy reference, or any combination.  Extract whatever
      structured signal you can.  Be conservative — omit fields you are not
      confident about rather than guessing.

      For authors: return ONLY surnames you can actually see in the fragment.
      If the fragment has no author names (e.g., it's just a title and year),
      return an empty array [].  Never invent placeholders.

      Fragment:
      #{@fragment}
    PROMPT
  end

  # =====================================================================
  # Stage 3: Crossref search
  # =====================================================================

  def search_crossref(query)
    params = build_crossref_params(query)
    url = "#{CROSSREF_API}?#{params}"
    res = http_get(url)
    return [] unless res.is_a?(Net::HTTPSuccess)

    items = JSON.parse(res.body).dig('message', 'items') || []
    # Cap candidates at 25 for sparse queries (where the right paper may
    # be deep in Crossref ranking) and 10 for title-rich queries.
    cap = query['title_fragment'].to_s.strip.empty? ? 25 : 10
    items.first(cap).map { |it| map_crossref_item(it) }.compact
  rescue JSON::ParserError
    []
  end

  AUTHOR_PLACEHOLDER_REGEX = /\A<?\s*(unknown|n\/?a|none|anonymous|anon|unspecified|tbd|tba|placeholder)\s*>?\z/i.freeze

  def build_crossref_params(query)
    parts = []

    # Strip empty strings and placeholder tokens (e.g., "<UNKNOWN>",
    # "anonymous") that the parser may emit when no author is in the
    # fragment.  Sending those to Crossref poisons the relevance ranking.
    authors = Array(query['authors']).reject { |a|
      s = a.to_s.strip
      s.empty? || s.match?(AUTHOR_PLACEHOLDER_REGEX)
    }
    if authors.any?
      parts << "query.author=#{URI.encode_www_form_component(authors.join(' '))}"
    end

    title_fragment = query['title_fragment'].to_s.strip
    journal_hint   = query['journal_hint'].to_s.strip
    year           = query['year']

    bib_terms = []
    bib_terms << title_fragment if title_fragment.length > 0
    bib_terms << journal_hint   if journal_hint.length   > 0
    if bib_terms.any?
      parts << "query.bibliographic=#{URI.encode_www_form_component(bib_terms.join(' '))}"
    end

    # Year handling is adaptive:
    #   * Title fragment present → relevance-rank by title; year filter
    #     hurts when Crossref's year metadata is wrong (preprints,
    #     late-registered DOIs).  Skip the filter.
    #   * No title fragment → year is the strongest disambiguator.  Use
    #     it as a hard filter so we don't drown in random author hits.
    if title_fragment.empty? && year.is_a?(Integer)
      parts << "filter=from-pub-date:#{year},until-pub-date:#{year}"
    end

    # Sparse queries (no title) need a wider net — the right paper may be
    # well below position 8 in Crossref's relevance ranking.  Title-rich
    # queries are usually nailed by position 0 or 1.
    rows = title_fragment.empty? ? 30 : 10
    parts << "rows=#{rows}"
    parts << 'select=DOI,title,author,published-print,published-online,issued,container-title,volume,issue,page,abstract,subject,publisher,type'
    parts.join('&')
  end

  def map_crossref_item(item)
    return nil if item.nil?

    title = clean_text(Array(item['title']).first.to_s)
    return nil if title.empty?

    authors_array = Array(item['author']).map do |a|
      family = a['family'].to_s.strip
      given  = a['given'].to_s.strip
      orcid  = a['ORCID'].to_s.sub(%r{\Ahttps?://(www\.)?orcid\.org/}, '').presence
      next nil if family.empty? && given.empty?
      { family: family, given: given, orcid: orcid }
    end.compact

    authors_string = authors_array.map { |a|
      if a[:given].to_s.empty?
        a[:family]
      else
        initials = a[:given].split(/\s+/).map { |g| g[0]&.upcase }.compact.join('. ')
        "#{a[:family]}, #{initials}."
      end
    }.join(', ')

    year = extract_year(item)
    journal = clean_text(Array(item['container-title']).first.to_s).presence

    {
      title: title,
      authors: authors_string,
      authors_data: authors_array.map { |a| { given: a[:given], family: a[:family], orcid: a[:orcid] }.compact },
      year: year,
      kind: map_crossref_type(item['type']),
      doi: item['DOI'],
      url: item['DOI'] ? "https://doi.org/#{item['DOI']}" : nil,
      journal_name: journal,
      volume: item['volume'].to_s.strip.presence,
      issue: item['issue'].to_s.strip.presence,
      pages: item['page'].to_s.strip.presence,
      publisher_or_venue: item['publisher'].to_s.strip.presence,
      abstract: clean_crossref_abstract(item['abstract']),
      keywords: Array(item['subject']),
      summary: clean_crossref_abstract(item['abstract']),
    }
  end

  def extract_year(item)
    parts = item.dig('issued', 'date-parts')&.first ||
            item.dig('published-print', 'date-parts')&.first ||
            item.dig('published-online', 'date-parts')&.first
    parts&.first
  end

  def map_crossref_type(type)
    case type
    when 'journal-article'        then 'article'
    when 'book', 'monograph'      then 'book'
    when 'book-chapter'           then 'book_chapter'
    when 'proceedings-article'    then 'conference_paper'
    when 'dissertation'           then 'thesis'
    when 'posted-content'         then 'preprint'
    when 'report'                 then 'report'
    else 'article'
    end
  end

  def clean_crossref_abstract(raw)
    return nil if raw.blank?
    text = clean_text(raw.to_s)
    text.empty? ? nil : text
  end

  # Crossref returns titles, journal names, and abstracts with embedded
  # HTML/JATS markup ("<em>", "<jats:p>", etc.) and HTML entities.  Strip
  # tags first, then unescape entities, then collapse whitespace.
  def clean_text(raw)
    return '' if raw.blank?
    text = raw.to_s
    text = text.gsub(%r{<[^>]+>}, ' ')
    text = CGI.unescapeHTML(text)
    text.gsub(/\s+/, ' ').strip
  end

  # =====================================================================
  # Stage 4: Haiku disambiguation
  # =====================================================================

  def disambiguate_with_haiku(candidates, sparse_query: false)
    return [candidates.first, 'low'] if candidates.empty?

    body = {
      model: MODEL,
      max_tokens: 256,
      tools: [disambig_tool_schema],
      tool_choice: { type: 'tool', name: 'pick_match' },
      messages: [{ role: 'user', content: disambig_prompt(candidates, sparse_query: sparse_query) }]
    }
    res = call_anthropic(body)
    return [candidates.first, 'low'] unless res.is_a?(Net::HTTPSuccess)

    parsed = JSON.parse(res.body)
    tool_use = Array(parsed['content']).find { |b| b['type'] == 'tool_use' }
    return [candidates.first, 'low'] unless tool_use

    idx = tool_use.dig('input', 'index').to_i
    confidence = tool_use.dig('input', 'confidence').to_s
    confidence = 'low' unless %w[high medium low].include?(confidence)

    chosen = candidates[idx] || candidates.first
    [chosen, confidence]
  rescue JSON::ParserError
    [candidates.first, 'low']
  end

  def disambig_tool_schema
    {
      name: 'pick_match',
      description: 'Pick the candidate that best matches the citation fragment.',
      input_schema: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'Zero-based index of the best-matching candidate.  Use 0 if none clearly match.'
          },
          confidence: {
            type: 'string',
            enum: %w[high medium low],
            description: 'high = clearly the right paper; medium = probably right; low = unsure.'
          }
        },
        required: ['index', 'confidence']
      }
    }
  end

  def disambig_prompt(candidates, sparse_query: false)
    listing = candidates.each_with_index.map { |c, i|
      "#{i}. #{c[:authors]} (#{c[:year] || 'n.d.'}). #{c[:title]}. #{c[:journal_name] || ''}".strip
    }.join("\n")

    sparse_note = sparse_query ? <<~SPARSE : ''
      NOTE: The fragment contains only an author surname and year, with no
      title, topic, or journal hint.  You CANNOT genuinely disambiguate
      between candidates — return confidence "low" and pick index 0.
    SPARSE

    <<~PROMPT
      The user provided this citation fragment:

      #{@fragment}

      Crossref returned these candidates:

      #{listing}

      #{sparse_note}
      Pick the candidate that best matches the fragment.

      Confidence levels:
      - "high":   fragment contains title or distinctive topic words that clearly match
      - "medium": fragment partially matches one candidate noticeably better than others
      - "low":    fragment too sparse to disambiguate, OR no candidate clearly matches

      Be honest about uncertainty.  When the fragment is just author + year
      with no topic, default to "low" — the user can pick from alternatives.
    PROMPT
  end

  # =====================================================================
  # Stage 5: OpenAlex enrichment
  # =====================================================================

  def enrich_with_openalex(candidate)
    return candidate if candidate[:doi].blank?

    res = http_get("#{OPENALEX_API}/doi:#{URI.encode_www_form_component(candidate[:doi])}")
    return candidate unless res.is_a?(Net::HTTPSuccess)

    work = JSON.parse(res.body)

    abstract = reconstruct_openalex_abstract(work['abstract_inverted_index']) || candidate[:abstract]
    concepts = Array(work['concepts'])
                 .select { |c| c['score'].to_f >= 0.4 }
                 .first(8)
                 .map { |c| c['display_name'] }
                 .compact

    keywords = (Array(candidate[:keywords]) + concepts).uniq

    candidate.merge(
      abstract: abstract,
      summary: candidate[:summary] || abstract,
      keywords: keywords,
    )
  rescue JSON::ParserError
    candidate
  end

  def reconstruct_openalex_abstract(inverted_index)
    return nil if inverted_index.blank?
    positions = []
    inverted_index.each do |word, idxs|
      Array(idxs).each { |i| positions[i] = word }
    end
    positions.compact.join(' ').presence
  end

  # =====================================================================
  # Stage 6: Last-resort enrichment
  #
  # When Crossref + OpenAlex didn't surface an abstract, fall through to
  # ArticleMetadataExtractor — its 4-tier DOI chain (Crossref / OpenAlex /
  # Semantic Scholar / DataCite) often picks up abstracts the first two
  # miss, especially for CS / preprint papers (Semantic Scholar) and
  # non-traditional DOIs (DataCite).  Fill gaps only — never overwrite
  # fields we already have from the matched candidate.
  # =====================================================================
  def fill_gaps_with_extractor(candidate)
    extractor_result = ArticleMetadataExtractor.new(candidate[:doi]).extract
    return candidate unless extractor_result.is_a?(Hash)

    filled = candidate.dup
    %w[abstract keywords pages volume issue journal_name publisher_or_venue authors_data].each do |k|
      sym_k = k.to_sym
      already_have = filled[sym_k].is_a?(Array) ? filled[sym_k].any? : filled[sym_k].to_s.strip.present?
      next if already_have

      val = extractor_result[k]
      val_present = val.is_a?(Array) ? val.any? : val.to_s.strip.present?
      filled[sym_k] = val if val_present
    end
    # Summary mirrors abstract when we don't have a separate user-provided one.
    filled[:summary] = filled[:abstract] if filled[:summary].blank? && filled[:abstract].present?
    filled
  rescue => e
    Rails.logger.warn "CitationResolver fill_gaps error: #{e.message}"
    candidate
  end

  # =====================================================================
  # HTTP helpers
  # =====================================================================

  def http_get(url)
    uri = URI(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    http.open_timeout = 8
    http.read_timeout = 20

    request = Net::HTTP::Get.new(uri.request_uri)
    request['User-Agent'] = USER_AGENT
    request['Accept']     = 'application/json'

    http.request(request)
  rescue => e
    Rails.logger.warn "CitationResolver http_get error (#{url}): #{e.message}"
    nil
  end

  def call_anthropic(body)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 30

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type']        = 'application/json'
    request['x-api-key']           = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version']   = '2023-06-01'
    request.body = body.to_json

    http.request(request)
  rescue => e
    Rails.logger.warn "CitationResolver call_anthropic error: #{e.message}"
    nil
  end

  # =====================================================================
  # Result envelopes
  # =====================================================================

  def success(best, alternatives, confidence)
    { ok: true, best: best, alternatives: alternatives, confidence: confidence }
  end

  def error(msg)
    { ok: false, error: msg }
  end
end
