require 'net/http'
require 'json'
require 'openssl'

class ArticleMetadataExtractor
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

  def initialize(url)
    @url = url
  end

  # Class method to extract metadata from PDF text using LLM
  # Used as fallback when DOI extraction/lookup fails
  def self.extract_from_pdf_text(pdf_text)
    Rails.logger.info "Attempting LLM extraction from PDF text (#{pdf_text.length} chars)"

    if ENV['ANTHROPIC_API_KEY'].blank?
      Rails.logger.error "ANTHROPIC_API_KEY not set, cannot use LLM fallback"
      return nil
    end

    prompt = <<~PROMPT
      You are a metadata extraction assistant. Extract academic article metadata from the following PDF text content.

      This is text extracted from a PDF document. Look for:
      - Title (usually at the top, larger text, before author names)
      - Authors (usually after title, before abstract)
      - Year (look for publication date, copyright year, or date in header/footer)
      - Journal name (usually in header/footer or after abstract)
      - Volume and issue numbers
      - Page numbers
      - DOI (if present, format: 10.xxxx/xxxx)
      - Abstract (usually labeled "Abstract" followed by a paragraph)
      - Keywords (often listed after abstract, labeled "Keywords:" or "Key words:")

      Extract and return ONLY a JSON object with these fields:
      - title: Article title
      - authors: Author names as a string (format: "Last, F., Last, F.")
      - authors_data: Array of author objects with {given, family, orcid} for each author.
          - orcid: If you see an ORCID identifier near the author (format "0000-0000-0000-000X",
            or a URL like "orcid.org/0000-0000-0000-000X", or "https://orcid.org/..."), include
            just the bare identifier (e.g., "0000-0002-1825-0097") for that author. Pair each
            ORCID with the author it is closest to in the text. Omit the orcid field if you
            are not confident which author it belongs to.
      - year: Publication year (integer)
      - kind: Source type (usually "article" for PDFs)
      - journal_name: Journal name
      - volume: Volume number
      - issue: Issue number
      - pages: Page range (e.g., "123-145")
      - doi: DOI if found
      - abstract: Article abstract
      - keywords: Array of keywords/key terms from the article

      Only include fields that you can confidently extract. Return valid JSON only, no other text.

      PDF Text Content (first 8000 chars):
      #{pdf_text[0..8000]}
    PROMPT

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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }.to_json

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      result = JSON.parse(response.body)
      text_content = result.dig('content', 0, 'text')

      Rails.logger.info "LLM PDF extraction response received, parsing..."

      # Extract JSON from response
      json_text = text_content.strip

      # If wrapped in markdown code blocks, extract content
      if json_text.match?(/```/)
        json_match = json_text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
        json_text = json_match[1] if json_match
      end

      # Extract only the JSON object
      json_start = json_text.index('{')
      json_end = json_text.rindex('}')

      if json_start && json_end && json_end > json_start
        json_text = json_text[json_start..json_end]
      end

      metadata = JSON.parse(json_text)

      if metadata.empty? || !metadata['title']
        Rails.logger.warn "LLM extraction returned empty or invalid metadata"
        return nil
      end

      # Normalize ORCIDs the LLM may have returned as URLs
      if metadata['authors_data'].is_a?(Array)
        metadata['authors_data'].each do |author|
          next unless author.is_a?(Hash) && author['orcid']
          bare = author['orcid'].to_s.strip.sub(%r{^https?://}, '').sub(%r{^orcid\.org/}, '')
          author['orcid'] = bare.match?(/\A\d{4}-\d{4}-\d{4}-\d{3}[\dX]\z/i) ? bare.upcase : nil
        end
      end

      Rails.logger.info "Successfully extracted metadata from PDF text using LLM: #{metadata['title']}"
      metadata
    else
      Rails.logger.error "LLM API request failed: #{response.code}"
      nil
    end
  rescue JSON::ParserError => e
    Rails.logger.error "Failed to parse LLM response JSON: #{e.message}"
    nil
  rescue => e
    Rails.logger.error "LLM PDF extraction error: #{e.class} - #{e.message}"
    nil
  end

  def extract
    # If input is a bare DOI (e.g., "10.1234/abc"), convert to doi.org URL
    if @url.match?(/^10\.\d{4,}\//) && !@url.match?(/^https?:\/\//i)
      @url = "https://doi.org/#{@url}"
      Rails.logger.info "Converted bare DOI to URL: #{@url}"
    end

    # First, try to extract DOI from URL (fastest)
    doi = extract_doi_from_url(@url)
    if doi
      Rails.logger.info "Found DOI in URL: #{doi}, trying metadata APIs"
      metadata = extract_from_doi_with_fallbacks(doi)
      return metadata if metadata
    end

    # If no DOI in URL, and URL looks like a valid web URL, fetch page and search HTML for DOI
    # Skip this step if the input doesn't have a proper URL scheme
    if @url.match?(/^https?:\/\//i)
      begin
        page_content, raw_content = fetch_page_content_with_raw

        # Try raw content first (before encoding conversion)
        doi = extract_doi_from_raw_html(raw_content) if raw_content

        # If not found in raw, try decoded content
        doi ||= extract_doi_from_html(page_content)

        if doi
          Rails.logger.info "Found DOI in HTML: #{doi}, trying metadata APIs"
          metadata = extract_from_doi_with_fallbacks(doi)
          return metadata if metadata
        end
      rescue => e
        Rails.logger.warn "Failed to fetch page for DOI extraction: #{e.message}"
      end
    end

    # Fall back to AI extraction with the page content we already fetched
    Rails.logger.info "No DOI found or CrossRef failed, trying AI extraction"

    if ENV['ANTHROPIC_API_KEY'].blank?
      raise "ANTHROPIC_API_KEY environment variable is not set. Please set it to use AI extraction."
    end

    # Use page_content if we already have it, otherwise fetch it
    # But only if we have a valid HTTP URL
    unless page_content
      unless @url.match?(/^https?:\/\//i)
        raise "Invalid URL format. Please enter a full URL (starting with http:// or https://) or a DOI."
      end
      page_content, _raw = fetch_page_content_with_raw
    end

    extract_metadata_with_ai(page_content)
  end

  private

  def strip_html_tags(text)
    return nil if text.nil?
    # Strip HTML/XML tags and decode HTML entities
    text = text.gsub(/<[^>]+>/, ' ')  # Replace tags with space
    text = text.gsub(/\s+/, ' ')      # Collapse multiple spaces
    text = text.strip                  # Remove leading/trailing whitespace
    # Decode common HTML entities
    text = text.gsub('&lt;', '<')
    text = text.gsub('&gt;', '>')
    text = text.gsub('&amp;', '&')
    text = text.gsub('&quot;', '"')
    text = text.gsub('&apos;', "'")
    text
  end

  def extract_doi_from_url(url)
    # Check if it's a doi.org URL
    if url.match?(/doi\.org/)
      doi = url.match(/doi\.org\/(10\.\d{4,}\/[^\s]+)/i)
      return doi[1] if doi
    end

    # Check if it's a direct DOI (e.g., "10.1234/abcd")
    if url.match?(/^10\.\d{4,}\//)
      return url
    end

    # Check if DOI is in the URL path (common patterns)
    doi = url.match(/(10\.\d{4,}\/[^\s&?]+)/i)
    return doi[1] if doi

    # ScienceDirect PII to DOI conversion
    # PIIs look like: S0065260106380021
    # Convert to DOI format
    if url.match?(/sciencedirect\.com/i) && url.match?(/pii\/([A-Z0-9]+)/i)
      pii = url.match(/pii\/([A-Z0-9]+)/i)[1]
      # Try common ScienceDirect DOI patterns
      # Format: 10.1016/S0065-2601(06)38002-1
      # This is a heuristic, might not always work
      Rails.logger.info "Found ScienceDirect PII: #{pii}, will search HTML for DOI"
    end

    nil
  end

  def extract_doi_from_html(html)
    # Try meta tags first (most reliable)
    meta_patterns = [
      /<meta[^>]+name=["']citation_doi["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']DC\.identifier["'][^>]+content=["']doi:([^"']+)["']/i,
      /<meta[^>]+name=["']prism\.doi["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']citation_doi["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']citation_doi["']/i
    ]

    meta_patterns.each do |pattern|
      match = html.match(pattern)
      if match && match[1]
        doi = match[1].strip
        # Clean up common prefixes
        doi = doi.sub(/^doi:\s*/i, '')
        doi = doi.sub(%r{^https?://doi\.org/}, '')
        return doi if doi.match?(/^10\.\d{4,}\//)
      end
    end

    # Look for DOI links (https://doi.org/...)
    doi_link = html.match(%r{href=["']https?://doi\.org/(10\.\d{4,}/[^"']+)["']}i)
    if doi_link
      doi = doi_link[1].strip
      Rails.logger.info "Found DOI link in HTML: #{doi}"
      return doi
    end

    # Try JSON-LD structured data
    json_ld = html.scan(/<script type="application\/ld\+json">(.*?)<\/script>/m)
    json_ld.each do |script|
      begin
        data = JSON.parse(script[0])
        # Check for DOI in various fields
        ['doi', 'identifier', '@id'].each do |field|
          if data[field]
            doi = data[field].to_s.sub(/^doi:\s*/i, '').sub(%r{^https?://doi\.org/}, '')
            return doi if doi.match?(/^10\.\d{4,}\//)
          end
        end
      rescue JSON::ParserError
        next
      end
    end

    # Search plain text (less reliable but works)
    text_match = html.match(/(?:doi:|DOI:?\s*)(10\.\d{4,}\/[^\s<>"']+)/i)
    return text_match[1].strip if text_match

    # Look for standalone DOI pattern in text
    doi_match = html.match(/\b(10\.\d{4,}\/[^\s<>"']+)\b/)
    return doi_match[1].strip if doi_match

    nil
  end

  def extract_from_crossref(doi)
    uri = URI("https://api.crossref.org/works/#{URI.encode_www_form_component(doi)}")

    request = Net::HTTP::Get.new(uri.request_uri)
    request['User-Agent'] = 'Mozilla/5.0 (Map My Research App; mailto:research@example.com)'

    # Try with standard SSL verification first, fall back to relaxed verification if CRL check fails
    response = nil
    [true, false].each do |strict_ssl|
      begin
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.open_timeout = 10
        http.read_timeout = 10

        if strict_ssl
          http.verify_mode = OpenSSL::SSL::VERIFY_PEER
        else
          # Relaxed mode: still verify peer but don't fail on CRL issues
          http.verify_mode = OpenSSL::SSL::VERIFY_PEER
          http.verify_callback = lambda { |preverify_ok, store_ctx|
            # Accept if basic verification passed, even if CRL check failed
            return true if preverify_ok
            # Accept CRL-related errors (error codes 3, 12)
            err = store_ctx.error
            return true if [3, 12].include?(err)
            false
          }
        end

        response = http.request(request)
        break # Success, exit the retry loop
      rescue OpenSSL::SSL::SSLError => e
        if strict_ssl && e.message.include?('certificate')
          Rails.logger.warn "CrossRef SSL strict mode failed, trying relaxed mode: #{e.message}"
          next # Try relaxed mode
        else
          raise # Re-raise if already in relaxed mode or different error
        end
      end
    end

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      message = data['message']

      # Extract authors - both display string and structured data
      authors_array = message['author']&.map do |author|
        if author['family'] && author['given']
          "#{author['family']}, #{author['given'][0]}."
        elsif author['family']
          author['family']
        else
          author['name']
        end
      end || []

      # Structured author data for disambiguation
      authors_data = message['author']&.each_with_index&.map do |author, idx|
        {
          'given' => author['given'],
          'family' => author['family'],
          'orcid' => author['ORCID']&.sub('https://orcid.org/', ''),
          'affiliation' => author['affiliation']&.first&.dig('name'),
          'sequence' => idx == 0 ? 'first' : 'additional'
        }.compact
      end || []

      # Determine article type
      type = message['type']
      kind = case type
      when 'journal-article' then 'article'
      when 'book-chapter' then 'book_chapter'
      when 'book' then 'book'
      when 'proceedings-article' then 'conference'
      when 'report' then 'report'
      when 'dissertation' then 'dissertation'
      else 'article'
      end

      # Extract publication date
      pub_date = message.dig('published', 'date-parts', 0)
      year = pub_date&.first
      publication_date = if pub_date && pub_date.length >= 3
        Date.new(pub_date[0], pub_date[1], pub_date[2]) rescue nil
      end

      # Extract keywords/subjects from CrossRef
      keywords = message['subject'] || []

      metadata = {
        'title' => message['title']&.first,
        'authors' => authors_array.join(', '),
        'authors_data' => authors_data,
        'year' => year,
        'kind' => kind,
        'journal_name' => message['container-title']&.first,
        'volume' => message['volume'],
        'issue' => message['issue'],
        'pages' => message['page'],
        'doi' => doi,
        'url' => "https://doi.org/#{doi}",
        'abstract' => strip_html_tags(message['abstract']),
        'keywords' => keywords,
        'publisher_or_venue' => message['publisher'],
        'book_title' => message['container-title']&.first
      }

      # Clean up nil values
      metadata.compact!

      Rails.logger.info "Successfully extracted metadata from CrossRef"
      metadata
    else
      Rails.logger.warn "CrossRef API failed: #{response.code}"
      nil
    end
  rescue => e
    Rails.logger.error "CrossRef extraction error: #{e.message}"
    nil
  end

  def extract_from_openalex(doi)
    Rails.logger.info "Trying OpenAlex for DOI: #{doi}"
    uri = URI("https://api.openalex.org/works/https://doi.org/#{URI.encode_www_form_component(doi)}")

    request = Net::HTTP::Get.new(uri.request_uri)
    request['User-Agent'] = 'MapMyResearch/1.0 (mailto:research@example.com)'

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 15

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)

      # Extract authors
      authors_array = data['authorships']&.map do |authorship|
        author = authorship['author']
        name = author['display_name']
        if name&.include?(' ')
          parts = name.split(' ')
          last = parts.last
          first_initial = parts.first[0]
          "#{last}, #{first_initial}."
        else
          name
        end
      end || []

      # Structured author data
      authors_data = data['authorships']&.each_with_index&.map do |authorship, idx|
        author = authorship['author']
        name_parts = (author['display_name'] || '').split(' ')
        {
          'given' => name_parts[0..-2].join(' '),
          'family' => name_parts.last,
          'orcid' => author['orcid']&.sub('https://orcid.org/', ''),
          'affiliation' => authorship.dig('institutions', 0, 'display_name'),
          'sequence' => idx == 0 ? 'first' : 'additional'
        }.compact
      end || []

      # Determine type
      type = data['type']
      kind = case type
      when 'journal-article', 'article' then 'article'
      when 'book-chapter' then 'book_chapter'
      when 'book' then 'book'
      when 'proceedings-article', 'conference-paper' then 'conference'
      when 'report' then 'report'
      when 'dissertation' then 'dissertation'
      else 'article'
      end

      # Extract keywords from OpenAlex concepts (top-level topics with score > 0.3)
      keywords = data['concepts']&.select { |c| c['score'] && c['score'] > 0.3 }&.map { |c| c['display_name'] } || []
      # Also include topics if available
      keywords += data['topics']&.map { |t| t['display_name'] } || []
      keywords = keywords.uniq.first(10) # Limit to 10 keywords

      metadata = {
        'title' => data['title'],
        'authors' => authors_array.join(', '),
        'authors_data' => authors_data,
        'year' => data['publication_year'],
        'kind' => kind,
        'journal_name' => data.dig('primary_location', 'source', 'display_name'),
        'volume' => data.dig('biblio', 'volume'),
        'issue' => data.dig('biblio', 'issue'),
        'pages' => [data.dig('biblio', 'first_page'), data.dig('biblio', 'last_page')].compact.join('-').presence,
        'doi' => doi,
        'url' => "https://doi.org/#{doi}",
        'abstract' => nil, # OpenAlex doesn't always have abstracts in free tier
        'keywords' => keywords,
        'publisher_or_venue' => data.dig('primary_location', 'source', 'host_organization_name')
      }

      metadata.compact!
      Rails.logger.info "Successfully extracted metadata from OpenAlex"
      metadata
    else
      Rails.logger.warn "OpenAlex API failed: #{response.code}"
      nil
    end
  rescue => e
    Rails.logger.error "OpenAlex extraction error: #{e.message}"
    nil
  end

  def extract_from_semantic_scholar(doi)
    Rails.logger.info "Trying Semantic Scholar for DOI: #{doi}"
    uri = URI("https://api.semanticscholar.org/graph/v1/paper/DOI:#{URI.encode_www_form_component(doi)}?fields=title,authors,year,venue,publicationTypes,abstract,externalIds")

    request = Net::HTTP::Get.new(uri.request_uri)
    request['User-Agent'] = 'MapMyResearch/1.0'

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 15

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)

      # Extract authors
      authors_array = data['authors']&.map do |author|
        name = author['name']
        if name&.include?(' ')
          parts = name.split(' ')
          last = parts.last
          first_initial = parts.first[0]
          "#{last}, #{first_initial}."
        else
          name
        end
      end || []

      # Structured author data
      authors_data = data['authors']&.each_with_index&.map do |author, idx|
        name_parts = (author['name'] || '').split(' ')
        {
          'given' => name_parts[0..-2].join(' '),
          'family' => name_parts.last,
          'sequence' => idx == 0 ? 'first' : 'additional'
        }.compact
      end || []

      # Determine type
      pub_types = data['publicationTypes'] || []
      kind = if pub_types.include?('JournalArticle')
        'article'
      elsif pub_types.include?('Conference')
        'conference'
      elsif pub_types.include?('Book')
        'book'
      else
        'article'
      end

      metadata = {
        'title' => data['title'],
        'authors' => authors_array.join(', '),
        'authors_data' => authors_data,
        'year' => data['year'],
        'kind' => kind,
        'journal_name' => data['venue'],
        'doi' => doi,
        'url' => "https://doi.org/#{doi}",
        'abstract' => data['abstract']
      }

      metadata.compact!
      Rails.logger.info "Successfully extracted metadata from Semantic Scholar"
      metadata
    else
      Rails.logger.warn "Semantic Scholar API failed: #{response.code}"
      nil
    end
  rescue => e
    Rails.logger.error "Semantic Scholar extraction error: #{e.message}"
    nil
  end

  def extract_from_datacite(doi)
    Rails.logger.info "Trying DataCite for DOI: #{doi}"
    uri = URI("https://api.datacite.org/dois/#{URI.encode_www_form_component(doi)}")

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Accept'] = 'application/json'

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 15

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      attrs = data.dig('data', 'attributes') || {}

      # Extract authors
      creators = attrs['creators'] || []
      authors_array = creators.map do |creator|
        if creator['familyName'] && creator['givenName']
          "#{creator['familyName']}, #{creator['givenName'][0]}."
        else
          creator['name']
        end
      end

      # Structured author data
      authors_data = creators.each_with_index.map do |creator, idx|
        {
          'given' => creator['givenName'],
          'family' => creator['familyName'],
          'orcid' => creator.dig('nameIdentifiers')&.find { |ni| ni['nameIdentifierScheme'] == 'ORCID' }&.dig('nameIdentifier')&.sub('https://orcid.org/', ''),
          'affiliation' => creator.dig('affiliation', 0, 'name'),
          'sequence' => idx == 0 ? 'first' : 'additional'
        }.compact
      end

      # Determine type
      resource_type = attrs.dig('types', 'resourceTypeGeneral')
      kind = case resource_type
      when 'JournalArticle', 'Text' then 'article'
      when 'Book' then 'book'
      when 'BookChapter' then 'book_chapter'
      when 'ConferencePaper' then 'conference'
      when 'Report' then 'report'
      when 'Dissertation' then 'dissertation'
      when 'Preprint' then 'article'
      else 'article'
      end

      metadata = {
        'title' => attrs.dig('titles', 0, 'title'),
        'authors' => authors_array.join(', '),
        'authors_data' => authors_data,
        'year' => attrs['publicationYear'],
        'kind' => kind,
        'doi' => doi,
        'url' => "https://doi.org/#{doi}",
        'abstract' => attrs.dig('descriptions')&.find { |d| d['descriptionType'] == 'Abstract' }&.dig('description'),
        'publisher_or_venue' => attrs['publisher']
      }

      metadata.compact!
      Rails.logger.info "Successfully extracted metadata from DataCite"
      metadata
    else
      Rails.logger.warn "DataCite API failed: #{response.code}"
      nil
    end
  rescue => e
    Rails.logger.error "DataCite extraction error: #{e.message}"
    nil
  end

  def extract_from_doi_with_fallbacks(doi)
    # Try each API in order until one succeeds
    Rails.logger.info "Attempting DOI lookup with fallback chain for: #{doi}"

    # 1. CrossRef (primary, most comprehensive for journal articles)
    metadata = extract_from_crossref(doi)
    return metadata if metadata

    # 2. OpenAlex (very comprehensive, good fallback)
    metadata = extract_from_openalex(doi)
    return metadata if metadata

    # 3. Semantic Scholar (good for CS/ML papers)
    metadata = extract_from_semantic_scholar(doi)
    return metadata if metadata

    # 4. DataCite (good for preprints, datasets, non-traditional DOIs)
    metadata = extract_from_datacite(doi)
    return metadata if metadata

    Rails.logger.warn "All DOI APIs failed for: #{doi}"
    nil
  end

  def extract_doi_from_raw_html(raw_html)
    # Search raw bytes for DOI patterns without encoding conversion
    # This helps when encoding is corrupting the DOI
    doi_patterns = [
      /doi\.org\/(10\.\d{4,}\/[^\s"'<>]+)/,
      /(?:DOI|doi):\s*(10\.\d{4,}\/[^\s"'<>]+)/,
      /\b(10\.\d{4,}\/[A-Z0-9\(\)\-\.]+)/i
    ]

    doi_patterns.each do |pattern|
      match = raw_html.match(pattern)
      if match
        doi = match[1].strip
        Rails.logger.info "Found DOI in raw HTML: #{doi}"
        return doi
      end
    end

    nil
  end

  def fetch_page_content_with_raw
    uri = URI(@url)

    request = Net::HTTP::Get.new(uri.request_uri)

    # Add headers to look like a real browser
    request['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    request['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    request['Accept-Language'] = 'en-US,en;q=0.5'
    request['Accept-Encoding'] = 'gzip, deflate, br'
    request['Connection'] = 'keep-alive'
    request['Upgrade-Insecure-Requests'] = '1'

    # Try with standard SSL verification first, fall back to relaxed verification if CRL check fails
    response = nil
    [true, false].each do |strict_ssl|
      begin
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = (uri.scheme == 'https')
        http.open_timeout = 10
        http.read_timeout = 10

        if uri.scheme == 'https'
          if strict_ssl
            http.verify_mode = OpenSSL::SSL::VERIFY_PEER
          else
            # Relaxed mode: still verify peer but don't fail on CRL issues
            http.verify_mode = OpenSSL::SSL::VERIFY_PEER
            http.verify_callback = lambda { |preverify_ok, store_ctx|
              return true if preverify_ok
              # Accept CRL-related errors (error codes 3, 12)
              err = store_ctx.error
              return true if [3, 12].include?(err)
              false
            }
          end
        end

        response = http.request(request)
        break # Success, exit the retry loop
      rescue OpenSSL::SSL::SSLError => e
        if strict_ssl && (e.message.include?('certificate') || e.message.include?('CRL'))
          Rails.logger.warn "SSL strict mode failed, trying relaxed mode: #{e.message}"
          next # Try relaxed mode
        else
          raise # Re-raise if already in relaxed mode or different error
        end
      end
    end

    # Follow redirects
    if response.is_a?(Net::HTTPRedirection)
      redirect_url = response['location']
      if redirect_url.start_with?('/')
        redirect_url = "#{uri.scheme}://#{uri.host}#{redirect_url}"
      end
      return ArticleMetadataExtractor.new(redirect_url).send(:fetch_page_content_with_raw)
    end

    if response.is_a?(Net::HTTPSuccess)
      # Handle gzip encoding if present
      body = response.body
      raw_body = body.dup.force_encoding('BINARY')

      if response['content-encoding'] == 'gzip'
        require 'zlib'
        require 'stringio'
        gz = Zlib::GzipReader.new(StringIO.new(body))
        body = gz.read
        raw_body = body.dup.force_encoding('BINARY')
      end

      # Handle character encoding more aggressively
      # Try to detect charset from Content-Type header
      content_type = response['content-type']
      charset = nil
      if content_type && content_type.match(/charset=([^\s;]+)/i)
        charset = $1
      end

      # Try charset from header first, then common encodings
      encodings_to_try = [charset, 'UTF-8', 'ISO-8859-1', 'Windows-1252'].compact.uniq

      valid_body = nil
      encodings_to_try.each do |encoding|
        begin
          valid_body = body.force_encoding(encoding).encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
          break if valid_body.valid_encoding?
        rescue Encoding::InvalidByteSequenceError, Encoding::UndefinedConversionError, Encoding::ConverterNotFoundError
          next
        end
      end

      body = valid_body || body.force_encoding('BINARY').encode('UTF-8', invalid: :replace, undef: :replace, replace: '')

      [body, raw_body]
    else
      raise "Failed to fetch URL: #{response.code} #{response.message}. Some websites block automated access. Try copying the page content or using the DOI instead."
    end
  rescue => e
    raise "Error fetching URL: #{e.message}. Some websites require manual access. Try entering metadata manually or using a direct PDF link."
  end

  def fetch_page_content
    uri = URI(@url)

    request = Net::HTTP::Get.new(uri.request_uri)

    # Add headers to look like a real browser
    request['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    request['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    request['Accept-Language'] = 'en-US,en;q=0.5'
    request['Accept-Encoding'] = 'gzip, deflate, br'
    request['Connection'] = 'keep-alive'
    request['Upgrade-Insecure-Requests'] = '1'

    # Try with standard SSL verification first, fall back to relaxed verification if CRL check fails
    response = nil
    [true, false].each do |strict_ssl|
      begin
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = (uri.scheme == 'https')
        http.open_timeout = 10
        http.read_timeout = 10

        if uri.scheme == 'https'
          if strict_ssl
            http.verify_mode = OpenSSL::SSL::VERIFY_PEER
          else
            # Relaxed mode: still verify peer but don't fail on CRL issues
            http.verify_mode = OpenSSL::SSL::VERIFY_PEER
            http.verify_callback = lambda { |preverify_ok, store_ctx|
              return true if preverify_ok
              # Accept CRL-related errors (error codes 3, 12)
              err = store_ctx.error
              return true if [3, 12].include?(err)
              false
            }
          end
        end

        response = http.request(request)
        break # Success, exit the retry loop
      rescue OpenSSL::SSL::SSLError => e
        if strict_ssl && (e.message.include?('certificate') || e.message.include?('CRL'))
          Rails.logger.warn "SSL strict mode failed, trying relaxed mode: #{e.message}"
          next # Try relaxed mode
        else
          raise # Re-raise if already in relaxed mode or different error
        end
      end
    end

    # Follow redirects
    if response.is_a?(Net::HTTPRedirection)
      redirect_url = response['location']
      if redirect_url.start_with?('/')
        redirect_url = "#{uri.scheme}://#{uri.host}#{redirect_url}"
      end
      return ArticleMetadataExtractor.new(redirect_url).send(:fetch_page_content)
    end

    if response.is_a?(Net::HTTPSuccess)
      # Handle gzip encoding if present
      body = response.body
      if response['content-encoding'] == 'gzip'
        require 'zlib'
        require 'stringio'
        gz = Zlib::GzipReader.new(StringIO.new(body))
        body = gz.read
      end

      # Handle character encoding more aggressively
      # Try to detect charset from Content-Type header
      content_type = response['content-type']
      charset = nil
      if content_type && content_type.match(/charset=([^\s;]+)/i)
        charset = $1
      end

      # Try charset from header first, then common encodings
      encodings_to_try = [charset, 'UTF-8', 'ISO-8859-1', 'Windows-1252'].compact.uniq

      valid_body = nil
      encodings_to_try.each do |encoding|
        begin
          valid_body = body.force_encoding(encoding).encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
          break if valid_body.valid_encoding?
        rescue Encoding::InvalidByteSequenceError, Encoding::UndefinedConversionError, Encoding::ConverterNotFoundError
          next
        end
      end

      body = valid_body || body.force_encoding('BINARY').encode('UTF-8', invalid: :replace, undef: :replace, replace: '')

      body
    else
      raise "Failed to fetch URL: #{response.code} #{response.message}. Some websites block automated access. Try copying the page content or using the DOI instead."
    end
  rescue => e
    raise "Error fetching URL: #{e.message}. Some websites require manual access. Try entering metadata manually or using a direct PDF link."
  end

  def extract_metadata_with_ai(html_content)
    prompt = <<~PROMPT
      You are a metadata extraction assistant. Extract article/source metadata from the following HTML content.

      Extract and return ONLY a JSON object with these fields:
      - title: Article title
      - authors: Author names as a string (format: "Last, F., Last, F.")
      - year: Publication year (integer)
      - kind: Source type (one of: article, book, book_chapter, conference, report, thesis, dissertation, website, video, podcast, other)
      - journal_name: Journal name (for articles)
      - volume: Volume number (for articles)
      - issue: Issue number (for articles)
      - pages: Page range (e.g., "123-145")
      - doi: DOI if available
      - url: The URL of the source
      - abstract: Article abstract or summary
      - keywords: Array of keywords
      - publisher_or_venue: Publisher/organization name (for books, reports, thesis, etc.)
      - book_title: Book title (for chapters)
      - edition: Edition (for books)
      - isbn: ISBN (for books)
      - website_name: Website name (for web sources, videos, podcasts)

      Only include fields that you can find. Return valid JSON only, no other text.

      HTML Content (first 10000 chars):
      #{html_content[0..10000]}
    PROMPT

    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }.to_json

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      result = JSON.parse(response.body)
      text_content = result.dig('content', 0, 'text')

      Rails.logger.info "Claude response received, parsing metadata..."
      Rails.logger.debug "Raw Claude response: #{text_content[0..500]}"

      # Extract JSON from response (handle both plain JSON and markdown-wrapped)
      json_text = text_content.strip

      # If wrapped in markdown code blocks, extract content between them
      if json_text.match?(/```/)
        json_match = json_text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
        json_text = json_match[1] if json_match
      end

      # Extract only the JSON object (find first { to last })
      json_start = json_text.index('{')
      json_end = json_text.rindex('}')

      if json_start && json_end && json_end > json_start
        json_text = json_text[json_start..json_end]
      end

      Rails.logger.debug "Cleaned JSON text: #{json_text[0..500]}"

      # Parse the JSON from Claude's response
      metadata = JSON.parse(json_text)

      # Check if Claude returned an error
      if metadata['error']
        raise "Claude could not extract metadata: #{metadata['error']}"
      end

      # Check if metadata is empty
      if metadata.empty? || metadata.keys == ['url']
        raise "Unable to extract metadata from this page. The page may be heavily obfuscated or require JavaScript. Try using the DOI directly if you have it, or enter metadata manually."
      end

      # Strip HTML/XML tags from text fields
      metadata['abstract'] = strip_html_tags(metadata['abstract']) if metadata['abstract']
      metadata['summary'] = strip_html_tags(metadata['summary']) if metadata['summary']

      # Add the original URL
      metadata['url'] = @url

      Rails.logger.info "Successfully parsed metadata with AI"
      metadata
    else
      error_msg = "Anthropic API request failed: #{response.code} #{response.body}"
      Rails.logger.error error_msg
      raise error_msg
    end
  rescue JSON::ParserError => e
    error_msg = "Failed to parse metadata JSON from Claude: #{e.message}"
    Rails.logger.error error_msg
    raise error_msg
  rescue => e
    error_msg = "AI extraction error: #{e.class} - #{e.message}"
    Rails.logger.error error_msg
    Rails.logger.error e.backtrace.first(5).join("\n")
    raise error_msg
  end
end
