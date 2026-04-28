require 'set'

# When the highlight-to-note flow detects an in-text citation like
# "(Creed, Fallon, & Hood, 2009)" we create a stub Source with just authors
# + year and the "Needs PDF" marker.  This job upgrades that stub by:
#
#   1. Opening the PARENT source's PDF (the paper that cited it)
#   2. Finding the matching line in the bibliography section (last name + year)
#   3. Sending that line to CitationResolver — same path the user-facing
#      "flesh out citation" feature uses
#   4. Filling in title / journal / DOI / abstract / etc.
#
# Falls back to hint-only resolution when the bibliography can't be matched.
# Never clobbers fields the user (or a prior enrichment) already set.
class EnrichCitedSourceJob < ApplicationJob
  queue_as :default

  PLACEHOLDER_TITLE_RE = /\A.+\(\d{4}\)\z|title (?:to be retrieved|needed)/i

  def perform(cited_source_id, parent_source_id, citation_hint)
    cited = Source.find_by(id: cited_source_id)
    return unless cited

    hint = symbolize_hint(citation_hint)
    fragment = bibliography_line(parent_source_id, hint) || fallback_fragment(hint)
    return if fragment.blank?

    Rails.logger.info "EnrichCitedSourceJob src=#{cited_source_id} parent=#{parent_source_id} fragment=#{fragment.truncate(120).inspect}"

    result = CitationResolver.resolve(fragment)
    unless result[:ok] && result[:best]
      Rails.logger.info "EnrichCitedSourceJob no resolution for src=#{cited_source_id}"
      return
    end

    apply_enrichment(cited, result[:best], result[:confidence])
  rescue => e
    Rails.logger.error "EnrichCitedSourceJob failed for src=#{cited_source_id}: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  private

  def symbolize_hint(h)
    return {} unless h.is_a?(Hash)
    {
      authors: h['authors'] || h[:authors],
      year:    h['year'] || h[:year],
    }
  end

  # Return the longest line in the parent PDF that mentions the first author's
  # last name AND the year — almost always the actual bibliography entry.
  # Returns nil when no parent PDF, no hint, or no match.
  def bibliography_line(parent_id, hint)
    return nil unless parent_id && hint[:authors].present? && hint[:year].present?

    parent = Source.find_by(id: parent_id)
    return nil unless parent&.pdf&.attached?

    last_name = first_author_last_name(hint[:authors])
    year = hint[:year].to_s
    return nil if last_name.blank? || year !~ /\A\d{4}\z/

    text = extract_pdf_text(parent)
    return nil if text.blank?

    candidates = candidate_lines(text, last_name, year)
    return nil if candidates.empty?

    # Pick the longest candidate (full bib entries are longer than narrative mentions).
    candidates.max_by(&:length)
  end

  def first_author_last_name(authors_str)
    raw = authors_str.to_s.strip
    return nil if raw.blank?

    # Try to grab just the first author entry, then their last name.
    # "Creed, P. A., Fallon, T., & Hood, M." → first entry "Creed", last "Creed"
    # "P. A. Creed and others"               → first entry "P. A. Creed", last "Creed"
    first = raw.split(/[;]|\s+(?:&|and)\s+|,\s+/i).first.to_s.strip
    return nil if first.blank?

    if first.include?(',')
      # "LastName, F. M." style
      first.split(',').first.strip
    else
      # "First Last" style — last token
      first.split(/\s+/).last
    end
  end

  def extract_pdf_text(source)
    source.pdf.blob.open do |file|
      # Pull a generous chunk: bibliographies live near the end.  100 pages
      # is more than enough for any normal article and caps cost.
      reader = PDF::Reader.new(file.path)
      reader.pages.first(100).map(&:text).join("\n")
    end
  rescue => e
    Rails.logger.warn "EnrichCitedSourceJob PDF read failed: #{e.message}"
    nil
  end

  # Split text into candidate "lines" (citations span lines in PDFs, so we
  # build sliding 1-3 line windows joined and deduped).  Then keep windows
  # containing both the author last name and the year.
  def candidate_lines(text, last_name, year)
    raw_lines = text.split(/\n+/).map(&:strip).reject(&:blank?)

    matches = Set.new
    raw_lines.each_with_index do |_, i|
      [1, 2, 3].each do |window_size|
        window = raw_lines[i, window_size]
        joined = window.join(' ').gsub(/\s+/, ' ')
        next unless joined.length.between?(40, 600)
        if joined =~ /\b#{Regexp.escape(last_name)}\b/i && joined.include?(year)
          matches << joined
        end
      end
    end
    matches.to_a
  end

  def fallback_fragment(hint)
    parts = [hint[:authors], hint[:year]].compact_blank.map(&:to_s)
    parts.any? ? parts.join(' ') : nil
  end

  # Apply enriched data without clobbering user/prior values.  Title is the
  # exception — we always replace placeholder titles like "Creed (2009)" with
  # the real one, but never overwrite something that already looks substantive.
  def apply_enrichment(source, best, confidence)
    updates = {}

    if best[:title].present? && (source.title.blank? || placeholder_title?(source.title))
      updates[:title] = best[:title]
    end
    updates[:authors]      = best[:authors]      if source.authors.blank?      && best[:authors].present?
    updates[:year]         = best[:year]         if source.year.blank?         && best[:year].present?
    updates[:journal_name] = best[:journal_name] if source.journal_name.blank? && best[:journal_name].present?
    updates[:doi]          = best[:doi]          if source.doi.blank?          && best[:doi].present?
    updates[:abstract]     = best[:abstract]     if source.abstract.blank?     && best[:abstract].present?
    updates[:url]          = best[:url]          if source.url.blank?          && best[:url].present?
    updates[:kind]         = best[:kind]         if source.kind.blank?         && best[:kind].present?

    # Drop the "Needs PDF" marker once we have a DOI — the user can chase it from there.
    if best[:doi].present? && Array(source.markers).include?('Needs PDF')
      updates[:markers] = Array(source.markers) - ['Needs PDF']
    end

    if updates.any?
      Rails.logger.info "EnrichCitedSourceJob updating src=#{source.id} (#{confidence}): #{updates.keys.inspect}"
      # `authors` collides with the has_many :authors association, so write
      # the column directly via []= and save once at the end.
      authors_value = updates.delete(:authors)
      source[:authors] = authors_value if authors_value
      source.assign_attributes(updates)
      source.save
    else
      Rails.logger.info "EnrichCitedSourceJob no fields to fill for src=#{source.id}"
    end
  end

  def placeholder_title?(title)
    s = title.to_s.strip
    s.match?(PLACEHOLDER_TITLE_RE) || s.match?(/[<>\[\]]/)
  end
end
