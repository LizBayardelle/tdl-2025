# Universal post-create enrichment for sources.  Runs the same auto-tag
# logic the bulk-upload pipeline gets — so a source created via manual
# input, Flesh Out, single-PDF upload, or bulk upload all end up with the
# same automatic enrichment.
#
# Skip-when-already-set guards prevent clobbering anything the user (or a
# prior pass) populated.  Each step is best-effort — failures log and the
# next step still runs.
class EnrichSourceJob < ApplicationJob
  queue_as :default

  def perform(source_id)
    source = Source.find_by(id: source_id)
    return unless source
    return if source.title.blank?

    user = source.user

    # 1. Research types — Haiku, controlled vocab
    if source.methodologies.blank?
      begin
        tags = ResearchTypeTagger.new(
          title: source.title,
          abstract: source.abstract,
          summary: source.summary,
          kind: source.kind
        ).tag
        if tags.any?
          source.methodologies = tags
          source.save!
        end
      rescue => e
        Rails.logger.warn "EnrichSourceJob research-type tag failed for #{source_id}: #{e.message}"
      end
    end

    # 2. Statistical tests — Haiku, dynamic vocab from StatisticalTest table.
    # Two-phase: try abstract first (cheap). If that finds nothing AND the
    # source qualifies for PDF escalation (empirical kind + PDF attached),
    # retry with PDF body text. Persists searched_at when done so the UI can
    # show "Searched, no tests found" instead of nagging.
    if source.statistical_tests.empty? && source.statistical_tests_searched_at.nil?
      begin
        tests = StatisticalTestTagger.new(
          title: source.title,
          abstract: source.abstract,
          summary: source.summary,
          kind: source.kind
        ).tag

        if tests.empty? && source.likely_describes_statistical_tests?
          pdf_text = extract_pdf_text(source)
          if pdf_text.present?
            tests = StatisticalTestTagger.new(
              title: source.title,
              abstract: source.abstract,
              summary: source.summary,
              kind: source.kind,
              pdf_text: pdf_text
            ).tag
          end
        end

        tests.each do |test|
          SourceStatisticalTest.find_or_create_by!(source: source, statistical_test: test)
        end
      rescue => e
        Rails.logger.warn "EnrichSourceJob stat-test tag failed for #{source_id}: #{e.message}"
      ensure
        source.update_columns(statistical_tests_searched_at: Time.current)
      end
    end

    # 3. Concepts — keyword exact-match + LLM suggestions, auto-link existing
    # and auto-create new.  Only runs when the source has no concepts yet,
    # so we don't clobber a user-curated concept list.
    if source.concepts.empty? && source.abstract.present?
      begin
        link_concepts_from_abstract(source, user)
      rescue => e
        Rails.logger.warn "EnrichSourceJob concept suggestion failed for #{source_id}: #{e.message}"
      end
    end
  rescue => e
    Rails.logger.error "EnrichSourceJob fatal for #{source_id}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  private

  def link_concepts_from_abstract(source, user)
    user_concepts_hash = user.concepts.pluck(:id, :label, :concept_type).map do |id, label, type|
      { id: id, label: label, concept_type: type }
    end

    suggestions = ConceptSuggestionService.new(
      title: source.title,
      abstract: source.abstract,
      keywords: source[:keywords] || [],
      user_concepts: user_concepts_hash
    ).suggest

    Array(suggestions).each do |sug|
      if sug['matched_concept_id']
        concept = user.concepts.find_by(id: sug['matched_concept_id'])
        source.concepts << concept if concept && !source.concepts.include?(concept)
      else
        label = sug['label'].to_s.strip
        next if label.blank?

        existing = user.concepts.find_by('LOWER(label) = LOWER(?)', label)
        new_concept = existing || begin
          user.concepts.create!(
            label: label,
            concept_type: sug['concept_type'].presence || 'non_physical_concept'
          )
        rescue ActiveRecord::RecordInvalid => e
          Rails.logger.warn "Auto-create concept failed for #{label}: #{e.message}"
          nil
        end
        source.concepts << new_concept if new_concept && !source.concepts.include?(new_concept)
      end
    end
  end

  # Pull plain text out of an attached PDF for LLM context. Returns "" on
  # any failure so the caller can fall through gracefully.
  def extract_pdf_text(source)
    return '' unless source.pdf.attached?
    source.pdf.open do |file|
      PdfTextExtractor.new(file).extracted_text.to_s
    end
  rescue => e
    Rails.logger.warn "EnrichSourceJob PDF text extraction failed for #{source.id}: #{e.message}"
    ''
  end
end
