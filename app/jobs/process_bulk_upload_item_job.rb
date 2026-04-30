# Process a single batch upload item:
# 1. Extract DOI from PDF
# 2. Fetch metadata from DOI APIs
# 3. Detect author matches
# 4. Suggest concepts
# 5. Check for duplicates
class ProcessBulkUploadItemJob < ApplicationJob
  queue_as :default

  # Retry with exponential backoff for transient errors
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(item_id)
    item = UploadBatchItem.find_by(id: item_id)
    return unless item
    return unless item.pdf.attached?

    Rails.logger.info "Processing batch upload item #{item_id}: #{item.original_filename}"

    begin
      # Download PDF to tempfile for processing
      pdf_tempfile = download_pdf(item)

      # Step 1: Extract DOI from PDF
      extractor = PdfTextExtractor.new(pdf_tempfile)
      doi = extractor.extract_doi
      pdf_text = extractor.extracted_text

      # Step 2: Fetch metadata
      metadata = nil
      extraction_method = nil

      if doi.present?
        Rails.logger.info "Found DOI: #{doi}, fetching metadata..."
        begin
          metadata_extractor = ArticleMetadataExtractor.new(doi)
          metadata = metadata_extractor.extract
          extraction_method = 'doi_api'
        rescue => e
          Rails.logger.warn "DOI lookup failed: #{e.message}"
        end
      end

      # Fallback to LLM extraction
      if metadata.nil? && pdf_text.present? && pdf_text.length > 100
        Rails.logger.info "Using LLM extraction for metadata..."
        metadata = ArticleMetadataExtractor.extract_from_pdf_text(pdf_text)
        extraction_method = 'llm' if metadata
      end

      # If no metadata extracted, mark as needing review with manual entry
      if metadata.nil?
        item.mark_extracted!(
          metadata: { 'title' => item.original_filename.gsub(/\.pdf$/i, '') },
          doi: doi,
          method: 'none',
          authors: [],
          concepts: [],
          duplicates: []
        )
        item.needs_review!('No metadata could be extracted automatically')
        return
      end

      # Step 3: Supplement metadata with PDF-extracted content
      # API keywords are often broad categories, not author-provided keywords
      # Extract keywords and abstract directly from PDF text to supplement
      # Do this BEFORE concept detection so the LLM can see the real keywords
      if pdf_text.present?
        pdf_keywords = extract_keywords_from_pdf_text(pdf_text)
        if pdf_keywords.any?
          Rails.logger.info "Found #{pdf_keywords.length} keywords in PDF text: #{pdf_keywords.join(', ')}"
          existing_keywords = metadata['keywords'] || []
          # Merge, avoiding duplicates (case-insensitive)
          existing_lower = existing_keywords.map(&:downcase)
          new_keywords = pdf_keywords.reject { |k| existing_lower.include?(k.downcase) }
          metadata['keywords'] = existing_keywords + new_keywords
        end

        # Extract abstract from PDF if not present in API metadata
        if metadata['abstract'].blank?
          pdf_abstract = extract_abstract_from_pdf_text(pdf_text)
          if pdf_abstract.present?
            Rails.logger.info "Extracted abstract from PDF text (#{pdf_abstract.length} chars)"
            metadata['abstract'] = pdf_abstract
          end
        end
      end

      # Step 4: Detect author matches
      detected_authors = detect_authors(item.user, metadata)

      # Step 5: Suggest concepts (uses keywords and abstract, including PDF-extracted ones)
      detected_concepts = suggest_concepts(item.user, metadata)

      # Step 6: Check for duplicates
      duplicates = check_duplicates(item.user, metadata, doi, item.original_filename)

      # Update item with extracted data
      item.mark_extracted!(
        metadata: metadata,
        doi: doi,
        method: extraction_method,
        authors: detected_authors,
        concepts: detected_concepts,
        duplicates: duplicates
      )

      # Auto-approve: items reach this point only if extraction succeeded
      # AND no duplicates were found AND nothing was flagged ambiguous.
      # The "default to flag disasters" philosophy — humans only intervene
      # for actual problems (duplicates / extraction failures); everything
      # clean ships straight to source creation.  Authors and concepts get
      # auto-resolved by CreateSourceFromUploadJob via its fallback paths.
      if item.reload.status_extracted?
        item.approve!({})
      end

      Rails.logger.info "Successfully processed item #{item_id}"
    rescue => e
      Rails.logger.error "Failed to process item #{item_id}: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      item.mark_failed!(e.message)
      raise # Re-raise for retry handling
    ensure
      pdf_tempfile&.close
      pdf_tempfile&.unlink
    end
  end

  private

  def download_pdf(item)
    tempfile = Tempfile.new(['batch_upload', '.pdf'])
    tempfile.binmode
    tempfile.write(item.pdf.download)
    tempfile.rewind
    tempfile
  end

  def detect_authors(user, metadata)
    authors_data = metadata['authors_data'] || []
    return [] if authors_data.empty?

    detected = []

    authors_data.each do |author_data|
      family = author_data['family']
      given = author_data['given']
      orcid = author_data['orcid']

      author_info = {
        'original' => "#{family}, #{given}",
        'family' => family,
        'given' => given,
        'orcid' => orcid,
        'potential_matches' => [],
        'ambiguous' => false,
        'auto_linked' => false
      }

      # Try exact ORCID match first
      if orcid.present?
        exact_match = user.people.find_by(orcid: orcid)
        if exact_match
          author_info['auto_linked'] = true
          author_info['linked_person_id'] = exact_match.id
          author_info['linked_person_name'] = exact_match.full_name
          detected << author_info
          next
        end
      end

      # Find potential name matches (but don't auto-link - same name doesn't mean same person)
      potential_matches = user.people.where(
        'LOWER(last_name) = LOWER(?) AND LOWER(first_name) LIKE LOWER(?)',
        family,
        "#{given&.first}%"
      ).limit(5)

      if potential_matches.any?
        # Show as suggestions, but require manual review
        author_info['potential_matches'] = potential_matches.map do |p|
          { 'id' => p.id, 'name' => p.full_name, 'orcid' => p.orcid }
        end
      else
        # No matches - will need to create new person
        author_info['potential_matches'] = []
      end

      detected << author_info
    end

    detected
  end

  def suggest_concepts(user, metadata)
    title = metadata['title']
    abstract = metadata['abstract']
    keywords = metadata['keywords'] || []

    return [] if title.blank?

    # Get existing user concepts for matching
    user_concepts = user.concepts.pluck(:id, :label, :concept_type)
    user_concepts_hash = user_concepts.map { |id, label, type| { id: id, label: label, concept_type: type } }
    concept_labels_lower = user_concepts.map { |_, label, _| label.downcase }

    suggestions = []

    # First, check keywords against existing concepts (fast, no API call)
    keywords.each do |keyword|
      # Skip invalid keywords (author names, volume numbers, dates, etc.)
      next unless valid_concept_keyword?(keyword)

      keyword_lower = keyword.downcase.strip

      # Only exact matches - substring matching causes false positives
      # (e.g., "workflow" shouldn't match a concept called "low")
      match_idx = concept_labels_lower.index { |l| l == keyword_lower }

      if match_idx
        concept = user_concepts[match_idx]
        suggestions << {
          'keyword' => keyword,
          'matched_concept_id' => concept[0],
          'matched_concept_label' => concept[1],
          'auto_linked' => true,
          'ambiguous' => false
        }
      else
        suggestions << {
          'keyword' => keyword,
          'auto_linked' => false,
          'ambiguous' => false,
          'suggestions' => []
        }
      end
    end

    # If we have an abstract and API key, use LLM for additional concept suggestions
    if abstract.present? && ENV['ANTHROPIC_API_KEY'].present?
      begin
        service = ConceptSuggestionService.new(
          title: title,
          abstract: abstract,
          keywords: keywords,
          user_concepts: user_concepts_hash
        )
        llm_suggestions = service.suggest

        # Add LLM suggestions that aren't already covered by keywords
        existing_keywords = suggestions.map { |s| s['keyword']&.downcase }.compact
        llm_suggestions.each do |llm_sug|
          label_lower = llm_sug['label'].downcase

          # Skip if this concept was already suggested from keywords
          next if existing_keywords.any? { |k| k == label_lower || k.include?(label_lower) || label_lower.include?(k) }

          if llm_sug['matched_concept_id']
            # LLM found a match to existing user concept
            suggestions << {
              'keyword' => llm_sug['label'],
              'matched_concept_id' => llm_sug['matched_concept_id'],
              'matched_concept_label' => llm_sug['matched_concept_label'],
              'auto_linked' => true,
              'ambiguous' => false,
              'source' => 'llm'
            }
          else
            # LLM suggested a new concept
            suggestions << {
              'keyword' => llm_sug['label'],
              'auto_linked' => false,
              'ambiguous' => false,
              'suggested_type' => llm_sug['concept_type'],
              'rationale' => llm_sug['rationale'],
              'confidence' => llm_sug['confidence'],
              'source' => 'llm'
            }
          end
        end
      rescue => e
        Rails.logger.warn "LLM concept suggestion failed: #{e.message}"
        # Continue with just keyword-based suggestions
      end
    end

    suggestions
  end

  def extract_keywords_from_pdf_text(text)
    return [] if text.blank?

    keywords = []

    # Note: PDF text is normalized (all whitespace collapsed to single spaces)
    # So we can't rely on \n - instead look for section boundaries
    keyword_patterns = [
      # Standard patterns - capture until next section or sentence end
      /key\s*words?\s*[:\-–]\s*(.+?)(?=\s+(?:Introduction|Abstract|Background|Methods?|1\.|I\.|©|\d{4}\s+Elsevier|Corresponding\s+author))/i,
      /keywords?\s*[:\-–]\s*(.+?)(?=\s+(?:Introduction|Abstract|Background|Methods?|1\.|I\.|©|\d{4}\s+Elsevier|Corresponding\s+author))/i,
      /index\s+terms?\s*[:\-–]\s*(.+?)(?=\s+(?:Introduction|Abstract|Background|Methods?|1\.|I\.|©))/i,
      # Fallback: capture a reasonable chunk after keywords
      /key\s*words?\s*[:\-–]\s*(.{20,300}?)(?:\.\s+[A-Z]|\s+\d+\.\s+[A-Z])/i,
      /keywords?\s*[:\-–]\s*(.{20,300}?)(?:\.\s+[A-Z]|\s+\d+\.\s+[A-Z])/i,
    ]

    keyword_patterns.each do |pattern|
      match = text.match(pattern)
      if match
        keyword_string = match[1].strip
        # Remove trailing copyright notices, author info, etc.
        keyword_string = keyword_string.sub(/\s*©.*$/i, '')
        keyword_string = keyword_string.sub(/\s*Corresponding author.*$/i, '')
        keyword_string = keyword_string.sub(/\s*\d{4}\s+Elsevier.*$/i, '')

        # Split by common delimiters (comma, semicolon, bullet points)
        found_keywords = keyword_string.split(/[,;•·|]/)
                                        .map(&:strip)
                                        .reject(&:blank?)
                                        .reject { |k| k.length < 4 || k.length > 60 } # Filter too short/long
                                        .reject { |k| k.match?(/^\d+$/) } # Filter numbers only
                                        .reject { |k| k.match?(/^https?:\/\//i) } # Filter URLs
                                        .reject { |k| %w[low high medium none null].include?(k.downcase) } # Filter generic terms
                                        .map { |k| k.gsub(/\s+/, ' ') } # Normalize whitespace

        if found_keywords.any?
          Rails.logger.info "Keywords pattern matched: #{found_keywords.join(', ')}"
          keywords.concat(found_keywords)
          break # Use first successful match
        end
      end
    end

    keywords.uniq
  end

  def extract_abstract_from_pdf_text(text)
    return nil if text.blank?

    # Note: PDF text is normalized (all whitespace collapsed to single spaces)
    # Patterns for abstract - look for section boundaries
    abstract_patterns = [
      # Standard "Abstract" followed by content until next section
      /\bAbstract\s*[:\-–]?\s*(.+?)(?=\s+(?:Keywords?|Key\s*words?|Introduction|Background|1\.\s+[A-Z]|I\.\s+[A-Z]|Methods?|Materials?|Highlights))/i,
      # Elsevier "Highlights" section (summary bullets) - treat as abstract if no abstract found
      /\bHighlights\s*[:\-–]?\s*(.+?)(?=\s+(?:Keywords?|Abstract|Introduction|1\.\s+[A-Z]))/i,
      # Summary section
      /\bSummary\s*[:\-–]?\s*(.+?)(?=\s+(?:Keywords?|Introduction|Background|1\.\s+[A-Z]))/i,
      # Fallback: looser pattern
      /\bAbstract\s*[:\-–]?\s*(.{100,2000}?)(?:\.\s+Keywords?|\.\s+1\.\s+|\.\s+Introduction)/i,
    ]

    abstract_patterns.each do |pattern|
      match = text.match(pattern)
      if match
        abstract = match[1].strip
        # Clean up the abstract
        abstract = abstract.gsub(/\s+/, ' ').strip # Normalize whitespace
        # Remove trailing artifacts
        abstract = abstract.sub(/\s*©.*$/i, '')
        abstract = abstract.sub(/\s*https?:\/\/.*$/i, '')

        # Abstracts are typically 100-500 words (roughly 500-3000 chars)
        # If too short or too long, might be a false match
        if abstract.length >= 80 && abstract.length <= 5000
          Rails.logger.info "Abstract extracted (#{abstract.length} chars)"
          return abstract
        end
      end
    end

    nil
  end

  def check_duplicates(user, metadata, doi, filename)
    duplicates = []

    # Helper to build duplicate info with full source details
    build_duplicate_info = ->(existing, type, match_value) {
      # Get authors string from source
      authors_str = existing.people.map(&:full_name).join(', ') if existing.people.any?

      {
        'type' => type,
        'id' => existing.id,
        'title' => existing.title,
        'year' => existing.year,
        'doi' => existing.doi,
        'authors' => authors_str,
        'match_value' => match_value
      }
    }

    # Check DOI
    if doi.present?
      existing = user.sources.find_by('LOWER(doi) = LOWER(?)', doi)
      if existing
        duplicates << build_duplicate_info.call(existing, 'doi', doi)
      end
    end

    # Check title (exact match, case-insensitive)
    title = metadata['title']
    if title.present?
      existing = user.sources.find_by('LOWER(title) = LOWER(?)', title.strip)
      if existing && duplicates.none? { |d| d['id'] == existing.id }
        duplicates << build_duplicate_info.call(existing, 'title', title)
      end
    end

    # Check PDF filename
    if filename.present?
      existing = user.sources.joins(:pdf_attachment)
                     .where(active_storage_attachments: { name: 'pdf' })
                     .joins('INNER JOIN active_storage_blobs ON active_storage_blobs.id = active_storage_attachments.blob_id')
                     .find_by('LOWER(active_storage_blobs.filename) = LOWER(?)', filename)
      if existing && duplicates.none? { |d| d['id'] == existing.id }
        duplicates << build_duplicate_info.call(existing, 'filename', filename)
      end
    end

    duplicates
  end

  # Validate that a keyword looks like a real academic concept, not metadata garbage
  def valid_concept_keyword?(keyword)
    return false if keyword.blank?

    label = keyword.to_s.strip
    label_lower = label.downcase

    # Too short or too long
    return false if label_lower.length < 4 || label_lower.length > 80

    # Generic/invalid words
    invalid_words = %w[low high medium none null undefined na n/a unfortunately however therefore moreover furthermore additionally]
    return false if invalid_words.include?(label_lower)

    # Contains periods (except common abbreviations) - likely sentence fragment or citation
    if label.include?('.')
      # Allow common abbreviations
      unless label.match?(/^(Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Corp|etc|vs|e\.g|i\.e)\b/i)
        Rails.logger.debug "Rejecting keyword with period: #{label}"
        return false
      end
    end

    # Volume/issue patterns
    return false if label_lower.match?(/\bvol\.?\s*\d+/i)
    return false if label_lower.match?(/\bno\.?\s*\d+/i)
    return false if label_lower.match?(/\bissue\s*\d+/i)
    return false if label_lower.match?(/\bvolume\s*\d+/i)

    # DOI patterns
    return false if label_lower.match?(/\bdoi[:\s]/i)
    return false if label_lower.match?(/10\.\d{4,}\//)

    # Date patterns (month + year)
    months = %w[january february march april may june july august september october november december]
    if months.any? { |month| label_lower.include?(month) }
      return false if label_lower.match?(/\d{4}/)
    end

    # Page number patterns
    return false if label_lower.match?(/^\d+[-–]\d+$/)
    return false if label_lower.match?(/\d+[-–]\d+\s*(doi|pp)/i)

    # Looks like a person's name (2-3 capitalized words without concept indicators)
    # Be very conservative - only reject if it REALLY looks like just a name
    if label.match?(/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/)
      # Extensive list of academic/concept indicator words
      concept_indicators = %w[
        theory model effect bias tendency syndrome phenomenon principle hypothesis framework
        approach method process system analysis strategy strategies support affect regulation
        emotion stress coping behavior behaviour learning memory attention perception cognition
        motivation performance anxiety depression disorder intervention treatment therapy
        development change adaptation response outcome variable factor influence relationship
        difference differences pattern mechanism skill competence capacity ability intelligence
        identity self personality trait state mood feeling attitude belief value goal
        incongruence congruence conflict resolution satisfaction engagement burnout exhaustion
        resilience vulnerability risk protective social emotional cognitive behavioral physical
        mental health psychological physiological biological neurological assessment measurement
        scale inventory questionnaire survey interview observation experiment study research
      ]
      unless concept_indicators.any? { |indicator| label_lower.include?(indicator) }
        Rails.logger.debug "Rejecting potential author name: #{label}"
        return false
      end
    end

    # Starts with conjunctions/articles followed by long text (sentence fragment)
    return false if label_lower.match?(/^(and|or|but|the|a|an)\s+.{15,}/i)

    # Contains "unfortunately", "however" etc. mid-text (sentence fragment)
    return false if label_lower.match?(/\s(unfortunately|however|therefore|moreover)\b/i)

    # Too many words (likely a sentence, not a concept)
    word_count = label.split(/\s+/).length
    return false if word_count > 6

    true
  end
end
