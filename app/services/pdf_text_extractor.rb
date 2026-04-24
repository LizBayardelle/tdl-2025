require 'open3'

class PdfTextExtractor
  # Patterns ordered by specificity - most specific first
  DOI_PATTERNS = [
    /doi\.org\/(10\.\d{4,}\/[^\s\]>"'\n]+)/i,           # doi.org URL
    /doi[\s]*[:\s]+\s*(10\.\d{4,}\/[^\s\]>"'\n]+)/i,    # "DOI: 10.xxx" or "DOI 10.xxx"
    /\bdoi\s+(10\.\d{4,}\/[^\s\]>"'\n]+)/i,             # "doi 10.xxx" (no colon)
    /\b(10\.\d{4,}\/[^\s\]>"'\n]+)/i                    # Standalone DOI
  ]

  # Below this, we consider PDF::Reader to have "failed" and try pdftotext.
  # Real papers easily clear 200 chars on just the title+authors of page 1.
  PDF_READER_MIN_USEFUL_LENGTH = 200

  def initialize(pdf_file)
    @pdf_file = pdf_file
  end

  def extract_doi
    text = extract_text(pages: 2)  # First 2 pages
    @extracted_text = text  # Store for potential LLM fallback
    Rails.logger.info "PDF text extracted, length: #{text.length} chars"
    Rails.logger.debug "PDF text sample (first 1000 chars): #{text[0..1000]}"

    doi = find_doi_in_text(text)
    Rails.logger.info "DOI extraction result: #{doi || 'not found'}"
    doi
  end

  # Get extracted text for LLM fallback when DOI lookup fails
  def extracted_text
    @extracted_text || extract_text(pages: 3)
  end

  private

  def extract_text(pages:)
    text = pdf_reader_extract(pages: pages)

    if text.length < PDF_READER_MIN_USEFUL_LENGTH
      Rails.logger.info "PDF::Reader returned #{text.length} chars — trying pdftotext fallback"
      fallback = pdftotext_extract(pages: pages)
      if fallback && fallback.length > text.length
        Rails.logger.info "pdftotext fallback extracted #{fallback.length} chars"
        text = fallback
      end
    end

    # Normalize whitespace - PDFs often have weird spacing
    normalized = text.gsub(/[[:space:]]+/, ' ')
    Rails.logger.debug "Normalized text sample: #{normalized[0..500].inspect}"
    normalized
  rescue => e
    Rails.logger.error "PDF text extraction failed: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    ""
  end

  def pdf_reader_extract(pages:)
    if @pdf_file.respond_to?(:path) && File.exist?(@pdf_file.path.to_s)
      Rails.logger.info "Reading PDF from path: #{@pdf_file.path}"
      reader = PDF::Reader.new(@pdf_file.path)
    else
      Rails.logger.info "Reading PDF from IO stream"
      @pdf_file.rewind if @pdf_file.respond_to?(:rewind)
      reader = PDF::Reader.new(@pdf_file)
    end

    text = reader.pages.first(pages).map(&:text).join("\n")
    Rails.logger.info "PDF::Reader extracted #{text.length} chars from #{[pages, reader.pages.count].min} pages"
    text
  rescue => e
    Rails.logger.warn "PDF::Reader failed: #{e.class} - #{e.message}"
    ""
  end

  def pdftotext_extract(pages:)
    path = ensure_local_path
    return nil unless path

    stdout, status = Open3.capture2('pdftotext', '-layout', '-f', '1', '-l', pages.to_s, path, '-')
    return nil unless status.success?
    stdout
  rescue Errno::ENOENT
    Rails.logger.warn "pdftotext not installed — skipping poppler fallback. Install poppler-utils to enable it."
    nil
  rescue => e
    Rails.logger.warn "pdftotext failed: #{e.class} - #{e.message}"
    nil
  end

  def ensure_local_path
    return @pdf_file.path if @pdf_file.respond_to?(:path) && File.exist?(@pdf_file.path.to_s)

    return nil unless @pdf_file.respond_to?(:read)

    @pdftotext_tempfile ||= begin
      tmp = Tempfile.new(['pdftotext-input', '.pdf'])
      tmp.binmode
      @pdf_file.rewind if @pdf_file.respond_to?(:rewind)
      tmp.write(@pdf_file.read)
      tmp.rewind
      tmp
    end
    @pdftotext_tempfile.path
  end

  def find_doi_in_text(text)
    # First try with original text
    DOI_PATTERNS.each_with_index do |pattern, idx|
      match = text.match(pattern)
      if match
        doi = clean_doi(match[1])
        Rails.logger.info "DOI found with pattern #{idx}: #{doi}"
        return doi
      end
    end

    # Try with more aggressive whitespace normalization
    # Some PDFs have invisible characters or weird Unicode
    cleaned_text = text
      .gsub(/[^\x20-\x7E\n]/, ' ')  # Remove non-printable chars
      .gsub(/\s+/, ' ')             # Collapse all whitespace
      .strip

    if cleaned_text != text
      Rails.logger.info "Trying with cleaned text (removed #{text.length - cleaned_text.length} non-ASCII chars)"
      DOI_PATTERNS.each_with_index do |pattern, idx|
        match = cleaned_text.match(pattern)
        if match
          doi = clean_doi(match[1])
          Rails.logger.info "DOI found in cleaned text with pattern #{idx}: #{doi}"
          return doi
        end
      end
    end

    # Log if we found "doi" or "10." anywhere but couldn't extract
    if text.downcase.include?('doi') || cleaned_text.downcase.include?('doi')
      # Find context around "doi" for debugging
      search_text = cleaned_text.downcase.include?('doi') ? cleaned_text : text
      doi_idx = search_text.downcase.index('doi')
      context = search_text[([doi_idx - 20, 0].max)..([doi_idx + 80, search_text.length - 1].min)]
      Rails.logger.warn "Found 'doi' in text but couldn't extract. Context: #{context.inspect}"
    elsif text.include?('10.') || cleaned_text.include?('10.')
      search_text = cleaned_text.include?('10.') ? cleaned_text : text
      doi_idx = search_text.index('10.')
      context = search_text[([doi_idx - 10, 0].max)..([doi_idx + 60, search_text.length - 1].min)]
      Rails.logger.warn "Found '10.' in text but couldn't extract DOI. Context: #{context.inspect}"
    else
      Rails.logger.warn "No 'doi' or '10.' found in extracted text"
    end

    nil
  end

  def clean_doi(doi)
    # Remove trailing punctuation that might be captured
    cleaned = doi.gsub(/[.,;:)\]]+$/, '').strip
    # Also remove any newlines or extra whitespace that snuck in
    cleaned = cleaned.gsub(/\s+/, '')

    # DOIs typically end with alphanumeric characters but NOT with trailing
    # lowercase letters that aren't part of the DOI (e.g., "nc" from "Preckel" running together)
    # Valid DOI endings: digits, uppercase letters, single lowercase after digit
    # Invalid: 2+ trailing lowercase letters after a digit (likely word fragment)

    # Pattern: digit followed by 2+ lowercase letters at end = likely word fragment
    # e.g., "10.1002/pits.20154nc" -> strip "nc"
    # But keep: "10.1234/abc123X" (uppercase at end is valid)
    # And keep: "10.1234/abc123a" (single lowercase is usually valid)
    if cleaned.match?(/\d[a-z]{2,}$/)
      trailing = cleaned.match(/([a-z]+)$/)&.[](1)
      if trailing && trailing.length >= 2
        # Likely a word fragment - strip it
        cleaned = cleaned.sub(/[a-z]{2,}$/, '')
        Rails.logger.info "Stripped likely word fragment from DOI: #{trailing}"
      end
    end

    cleaned
  end
end
