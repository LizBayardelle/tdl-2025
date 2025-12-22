require 'net/http'
require 'json'

class ArticleMetadataExtractor
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

  def initialize(url)
    @url = url
  end

  def extract
    # First, try to extract DOI from URL (fastest)
    doi = extract_doi_from_url(@url)
    if doi
      Rails.logger.info "Found DOI in URL: #{doi}, using CrossRef API"
      metadata = extract_from_crossref(doi)
      return metadata if metadata
    end

    # If no DOI in URL, fetch page and search HTML for DOI
    begin
      page_content, raw_content = fetch_page_content_with_raw

      # Try raw content first (before encoding conversion)
      doi = extract_doi_from_raw_html(raw_content) if raw_content

      # If not found in raw, try decoded content
      doi ||= extract_doi_from_html(page_content)

      if doi
        Rails.logger.info "Found DOI in HTML: #{doi}, using CrossRef API"
        metadata = extract_from_crossref(doi)
        return metadata if metadata
      end
    rescue => e
      Rails.logger.warn "Failed to fetch page for DOI extraction: #{e.message}"
    end

    # Fall back to AI extraction with the page content we already fetched
    Rails.logger.info "No DOI found or CrossRef failed, trying AI extraction"

    if ENV['ANTHROPIC_API_KEY'].blank?
      raise "ANTHROPIC_API_KEY environment variable is not set. Please set it to use AI extraction."
    end

    # Use page_content if we already have it, otherwise fetch it
    unless page_content
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
    uri = URI("https://api.crossref.org/works/#{doi}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 10

    request = Net::HTTP::Get.new(uri.path)
    request['User-Agent'] = 'Mozilla/5.0 (TDL Research App; mailto:research@example.com)'

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      message = data['message']

      # Extract authors
      authors_array = message['author']&.map do |author|
        if author['family'] && author['given']
          "#{author['family']}, #{author['given'][0]}."
        elsif author['family']
          author['family']
        else
          author['name']
        end
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

      metadata = {
        'title' => message['title']&.first,
        'authors' => authors_array.join(', '),
        'year' => year,
        'kind' => kind,
        'journal_name' => message['container-title']&.first,
        'volume' => message['volume'],
        'issue' => message['issue'],
        'pages' => message['page'],
        'doi' => doi,
        'url' => "https://doi.org/#{doi}",
        'abstract' => strip_html_tags(message['abstract']),
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

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.open_timeout = 10
    http.read_timeout = 10

    request = Net::HTTP::Get.new(uri.request_uri)

    # Add headers to look like a real browser
    request['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    request['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    request['Accept-Language'] = 'en-US,en;q=0.5'
    request['Accept-Encoding'] = 'gzip, deflate, br'
    request['Connection'] = 'keep-alive'
    request['Upgrade-Insecure-Requests'] = '1'

    response = http.request(request)

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

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.open_timeout = 10
    http.read_timeout = 10

    request = Net::HTTP::Get.new(uri.request_uri)

    # Add headers to look like a real browser
    request['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    request['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    request['Accept-Language'] = 'en-US,en;q=0.5'
    request['Accept-Encoding'] = 'gzip, deflate, br'
    request['Connection'] = 'keep-alive'
    request['Upgrade-Insecure-Requests'] = '1'

    response = http.request(request)

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
