class SourcesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_source, only: [:show, :study, :notes, :passage_insights, :sections, :ask, :enrich_from_citation, :update, :destroy]
  before_action :authorize_edit!, only: [:update, :destroy]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Source)
    base_scope = Source.where(id: accessible_ids)

    respond_to do |format|
      format.html
      format.json {
        # ---- Filter params ----
        q             = params[:q].to_s.strip
        kind          = params[:kind].to_s.strip
        concept_ids   = Array(params[:concept_ids]).map(&:to_i).reject(&:zero?)
        person_ids    = Array(params[:person_ids]).map(&:to_i).reject(&:zero?)
        tag_names     = Array(params[:tags]).map(&:to_s).reject(&:blank?)
        collection_ids = Array(params[:collection_ids]).map(&:to_i).reject(&:zero?)
        markers       = Array(params[:markers]).map(&:to_s).reject(&:blank?)
        methodologies = Array(params[:methodologies]).map(&:to_s).reject(&:blank?)
        year_min      = params[:year_min].presence&.to_i
        year_max      = params[:year_max].presence&.to_i
        has_pdf       = truthy?(params[:has_pdf])
        has_notes     = truthy?(params[:has_notes])

        scoped = apply_filters(base_scope,
          q: q, kind: kind,
          concept_ids: concept_ids, person_ids: person_ids,
          tag_names: tag_names, collection_ids: collection_ids,
          markers: markers, methodologies: methodologies,
          year_min: year_min, year_max: year_max,
          has_pdf: has_pdf, has_notes: has_notes,
          owner_id: current_user.id
        )

        # ---- Sorting ----
        sort_by  = params[:sort_by]
        sort_dir = params[:sort_dir] == 'desc' ? 'DESC' : 'ASC'
        scoped = case sort_by
        when 'title'        then scoped.reorder("LOWER(title) #{sort_dir}")
        when 'year'         then scoped.reorder("year #{sort_dir} NULLS LAST")
        when 'created_at'   then scoped.reorder("created_at #{sort_dir}")
        when 'notes_count'  then scoped.left_joins(:notes).group('sources.id').reorder("COUNT(notes.id) #{sort_dir}")
        else                     scoped.reorder("created_at DESC")
        end

        # ---- Pagination ----
        page     = [(params[:page] || 1).to_i, 1].max
        per_page = [(params[:per_page] || 20).to_i, 100].min
        total_count = scoped.except(:order).count(:id)
        total_count = total_count.is_a?(Hash) ? total_count.size : total_count
        paginated   = scoped.offset((page - 1) * per_page).limit(per_page)
          .includes(:concepts, :tags, :people, :collections, :notes,
                    :statistical_tests, :source_statistical_tests)
          .with_attached_pdf

        sources_data = paginated.map do |source|
          is_owner = source.user_id == current_user.id
          source.as_json(only: [:id, :title, :year, :kind, :doi, :abstract, :summary, :journal_name, :markers, :methodologies]).merge(
            'authors' => source.authors_string,
            tags: is_owner ? source.tags.pluck(:name) : [],
            keywords: source[:keywords] || [],
            concept_ids: source.concept_ids,
            concepts: source.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            people: source.people.map { |p| { id: p.id, full_name: p.full_name, last_name: p.last_name } },
            collections: source.collections.map { |c| { id: c.id, name: c.name } },
            statistical_tests: serialize_statistical_tests(source),
            statistical_tests_searched_at: source.statistical_tests_searched_at,
            notes_count: source.notes.size,
            has_pdf: source.pdf.attached?,
            pdf_url: source.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(source.pdf, only_path: true) : nil,
            pdf_filename: source.pdf.attached? ? source.pdf.filename.to_s : nil,
            permission: source.permission_for(current_user),
            is_owner: is_owner
          )
        end

        payload = {
          sources: sources_data,
          pagination: {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil,
          }
        }

        if page == 1
          payload[:filters] = build_filter_facets(base_scope, accessible_ids,
            applied: {
              q: q, kind: kind,
              concept_ids: concept_ids, person_ids: person_ids,
              tag_names: tag_names, collection_ids: collection_ids,
              markers: markers, methodologies: methodologies,
              year_min: year_min, year_max: year_max,
              has_pdf: has_pdf, has_notes: has_notes,
            })
        end

        render json: payload
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @source.as_json(
          include: {
            concepts: { only: [:id, :label, :concept_type, :summary] },
            people: { only: [:id, :full_name, :last_name, :role, :summary] },
            tags: { only: [:id, :name, :slug] },
            collections: { only: [:id, :name, :description] }
          }
        ).merge(
          # Source has both an `authors` text column and a `has_many :authors`
          # association.  The association shadows the column in as_json, AND
          # symbol-key merges leave the as_json string key in place.  Use a
          # string key here to actually replace the empty-association value.
          'authors' => @source.authors_string,
          concept_ids: @source.concept_ids,
          keywords: @source[:keywords] || [],
          statistical_tests: serialize_statistical_tests(@source),
          statistical_tests_searched_at: @source.statistical_tests_searched_at,
          notes_count: @source.notes.size,
          has_pdf: @source.pdf.attached?,
          pdf_url: @source.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(@source.pdf, only_path: true) : nil,
          pdf_filename: @source.pdf.attached? ? @source.pdf.filename.to_s : nil
        )
      }
    end
  end

  def study
    # Full-screen PDF study mode with notes sidebar
    render layout: 'study'
  end

  def notes
    @notes = @source.notes
                    .includes(:concepts, :people, :linked_sources, :collections, :tags)
                    .order(created_at: :desc)
    render json: @notes.map { |note|
      {
        id: note.id,
        title: note.title,
        body: note.body,
        note_type: note.note_type,
        context: note.context,
        pinned: note.pinned,
        noted_on: note.noted_on,
        page_number: note.page_number,
        quote_text: note.quote_text,
        quote_bounds: note.quote_bounds,
        created_at: note.created_at,
        updated_at: note.updated_at,
        source_id: note.source_id,
        concepts: note.concepts.map { |c| { id: c.id, label: c.label } },
        people: note.people.map { |p| { id: p.id, full_name: p.full_name, role: p.role } },
        linked_sources: note.linked_sources.map { |s| { id: s.id, title: s.title, year: s.year } },
        collections: note.collections.map { |c| { id: c.id, name: c.name } },
        tags: note.tags
      }
    }
  end

  def passage_insights
    text = params[:text].to_s.strip
    if text.length < 8
      render json: { error: 'Selection too short' }, status: :unprocessable_entity
      return
    end

    # Quota gate: AI-Assisted Note Taking is paper-scoped.  Free gets one
    # paper lifetime, Storage gets 10/month, Unlimited bypasses.  Already-
    # unlocked sources count as a hit (within window) and skip the limit.
    unless current_user.can_unlock_source_for_notes?(@source.id)
      cfg = current_user.paper_unlock_config
      window_label = cfg[:window] == :lifetime ? 'lifetime' : 'this month'
      render json: {
        error: 'note_taking_quota',
        message: "AI-Assisted Note Taking is limited to #{cfg[:count]} paper#{cfg[:count] == 1 ? '' : 's'} #{window_label} on the #{current_user.effective_plan.titleize} tier.",
        tier: current_user.effective_plan,
        upgrade_url: subscribe_path,
        quota: current_user.paper_unlock_quota,
      }, status: :payment_required
      return
    end

    current_user.unlock_source_for_notes!(@source.id)

    user_concepts = current_user.concepts
                                .order(updated_at: :desc)
                                .limit(PassageInsightService::MAX_CONCEPTS_IN_PROMPT)
                                .pluck(:id, :label)
                                .map { |id, label| { id: id, label: label } }

    user_people = current_user.people
                              .order(updated_at: :desc)
                              .limit(PassageInsightService::MAX_PEOPLE_IN_PROMPT)
                              .pluck(:id, :full_name)
                              .map { |id, name| { id: id, full_name: name } }

    result = PassageInsightService.new(
      passage: text,
      source_title: @source.title,
      source_abstract: @source.abstract,
      user_concepts: user_concepts,
      user_people: user_people
    ).call

    if result
      render json: result.merge(note_taking_quota: current_user.paper_unlock_quota)
    else
      render json: { error: 'Insight generation failed' }, status: :bad_gateway
    end
  end

  # POST /sources/:id/enrich_from_citation
  # Body: { parent_source_id: 7, citation_hint: { authors: "Creed, Fallon, & Hood", year: 2009 } }
  # Enqueues a background job that opens the parent source's PDF, finds the
  # matching bibliography line, and runs CitationResolver to fill in title,
  # journal, DOI, etc.  Fires-and-forgets — returns 202.
  def enrich_from_citation
    parent_id = params[:parent_source_id]
    hint = params[:citation_hint]&.to_unsafe_h || {}

    EnrichCitedSourceJob.perform_later(@source.id, parent_id&.to_i, hint)
    head :accepted
  end

  # POST /sources/:id/ask
  # Q&A against the source's PDF.  Unlimited tier only.
  def ask
    unless current_user.unlimited? || current_user.admin
      render json: {
        error: 'ask_the_paper_unlimited_only',
        message: "Ask the Paper is part of the Unlimited tier — chat with any paper as much as you want.",
        tier: current_user.effective_plan,
        upgrade_url: subscribe_path,
      }, status: :payment_required
      return
    end

    unless @source.pdf.attached?
      render json: { error: 'This source has no PDF to read.' }, status: :unprocessable_entity
      return
    end

    question = params[:question].to_s.strip
    if question.length < 4
      render json: { error: 'Ask a question first.' }, status: :unprocessable_entity
      return
    end

    result = @source.pdf.blob.open do |file|
      PaperQaService.new(pdf_file: file, question: question).call
    end

    render json: result
  end

  # GET /sources/:id/sections.json
  # Returns a list of section headings for the source's PDF.  Falls back to
  # an empty array if the source has no PDF or if Haiku can't find a clear
  # structure.
  def sections
    unless @source.pdf.attached?
      render json: { sections: [] }
      return
    end

    sections = @source.pdf.blob.open do |file|
      SectionDetectorService.new(file).call
    end
    render json: { sections: sections }
  end

  def create
    unless current_user.can_create_source?
      render json: {
        error: "Library is full",
        message: "You're past the free tier limit of #{User::FREE_SOURCE_LIMIT} articles.  Upgrade to Pro to keep importing.",
        upgrade_url: subscribe_path,
        quota_state: current_user.source_quota_state
      }, status: :payment_required
      return
    end

    tags_array = params[:source][:tags]
    authors_string = params[:source][:authors]
    keywords_array = params[:source][:keywords]
    concept_ids = params[:source][:concept_ids]
    person_ids = params[:source][:person_ids]
    collection_ids = params[:source][:collection_ids]
    statistical_test_ids = params[:source][:statistical_test_ids]
    override_authors = params[:source][:override_authors]
    processed_authors = params[:source][:processed_authors]
    processed_authors = JSON.parse(processed_authors) if processed_authors.is_a?(String)

    source_params_clean = source_params.except(:tags, :authors, :keywords, :concept_ids, :person_ids, :collection_ids, :statistical_test_ids, :override_authors, :processed_authors)

    @source = current_user.sources.build(source_params_clean)

    # Set keywords directly on column
    @source[:keywords] = keywords_array unless keywords_array.nil?

    if @source.save
      # Use Taggable concern for tags (creates Tag records)
      @source.tag_list = tags_array unless tags_array.nil?

      # Set concept associations
      @source.concept_ids = concept_ids unless concept_ids.nil?

      # Set statistical test associations
      @source.statistical_test_ids = Array(statistical_test_ids).reject(&:blank?).map(&:to_i) unless statistical_test_ids.nil?

      # Handle people associations
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          @source.people << person if person && !@source.people.include?(person)
        end
      end

      # Auto-generate authors from linked people unless override is enabled.
      # Note: PersonSource#after_create_commit keeps `authors` in sync with
      # the people association on every link.  In the override branch we
      # therefore set the typed string AFTER parse_and_link_authors so the
      # user-typed value wins over the callback-derived join.
      if override_authors == 'true' || override_authors == true
        parse_and_link_authors(@source, authors_string, processed_authors) if authors_string.present?
        @source[:authors] = authors_string if authors_string.present?
      elsif @source.people.any?
        @source[:authors] = @source.people.map(&:full_name).join(', ')
      end

      @source.save if @source.changed?

      # Add to collections if specified
      if collection_ids.present?
        collection_ids.each do |collection_id|
          next if collection_id.blank?
          collection = Collection.find_by(id: collection_id)
          if collection && (collection.user_id == current_user.id || collection.shared_with?(current_user))
            CollectionItem.find_or_create_by!(collection: collection, collectable: @source)
          end
        end
      end

      # Universal post-create enrichment: research types, stat tests, and
      # concept suggestion (only fires for fields not already populated).
      # Mirrors what bulk-upload sources get automatically.
      EnrichSourceJob.perform_later(@source.id)

      render json: @source.as_json.merge(
        'authors' => @source.authors_string,
        tags: @source.tags.pluck(:name),
        keywords: @source[:keywords] || [],
        concept_ids: @source.concept_ids,
        collections: @source.collections.map { |c| { id: c.id, name: c.name } },
        statistical_tests: serialize_statistical_tests(@source),
        statistical_tests_searched_at: @source.statistical_tests_searched_at
      ), status: :created
    else
      render json: { errors: @source.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    tags_array = params[:source][:tags]
    authors_string = params[:source][:authors]
    keywords_array = params[:source][:keywords]
    concept_ids = params[:source][:concept_ids]
    person_ids = params[:source][:person_ids]
    statistical_test_ids = params[:source][:statistical_test_ids]
    override_authors = params[:source][:override_authors]
    processed_authors = params[:source][:processed_authors]
    processed_authors = JSON.parse(processed_authors) if processed_authors.is_a?(String)

    source_params_clean = source_params.except(:tags, :authors, :keywords, :concept_ids, :person_ids, :collection_ids, :statistical_test_ids, :override_authors, :processed_authors)

    # Set keywords directly on column
    @source[:keywords] = keywords_array unless keywords_array.nil?

    if @source.update(source_params_clean)
      # Use Taggable concern for tags (creates Tag records)
      @source.tag_list = tags_array unless tags_array.nil?

      # Set concept associations
      @source.concept_ids = concept_ids unless concept_ids.nil?

      # Set statistical test associations. The default `_ids=` setter is a diff
      # (preserves rows whose IDs remain in the list), so existing autodetect
      # metadata on join rows survives manual saves that don't change the set.
      @source.statistical_test_ids = Array(statistical_test_ids).reject(&:blank?).map(&:to_i) unless statistical_test_ids.nil?

      # Handle people associations
      @source.person_sources.destroy_all
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          @source.people << person if person
        end
      end

      # Same as #create: in the override branch we set the typed string
      # AFTER parse_and_link_authors so the user-typed value wins over the
      # PersonSource callback's auto-derived join.
      if override_authors == 'true' || override_authors == true
        parse_and_link_authors(@source, authors_string, processed_authors) if authors_string.present?
        @source[:authors] = authors_string if authors_string.present?
      elsif @source.people.any?
        @source[:authors] = @source.people.map(&:full_name).join(', ')
      else
        @source[:authors] = nil
      end

      @source.save if @source.changed?

      render json: @source.as_json.merge(
        'authors' => @source.authors_string,
        tags: @source.tags.pluck(:name),
        keywords: @source[:keywords] || [],
        concept_ids: @source.concept_ids,
        statistical_tests: serialize_statistical_tests(@source),
        statistical_tests_searched_at: @source.statistical_tests_searched_at
      )
    else
      render json: { errors: @source.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @source.destroy
    head :no_content
  end

  def extract_metadata
    url = params[:url]

    if url.blank?
      render json: { error: 'URL is required' }, status: :unprocessable_entity
      return
    end

    begin
      extractor = ArticleMetadataExtractor.new(url)
      metadata = extractor.extract

      render json: metadata
    rescue => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  def extract_from_pdf
    unless params[:pdf].present?
      render json: { error: 'PDF file is required' }, status: :unprocessable_entity
      return
    end

    begin
      uploaded_file = params[:pdf]
      Rails.logger.info "PDF upload received: #{uploaded_file.original_filename}, size: #{uploaded_file.size} bytes"

      # Ensure tempfile is rewound to beginning
      uploaded_file.tempfile.rewind

      # Extract DOI from PDF
      extractor = PdfTextExtractor.new(uploaded_file.tempfile)
      doi = extractor.extract_doi

      metadata = nil

      if doi
        # Try DOI-based lookup with all APIs
        Rails.logger.info "Found DOI: #{doi}, trying metadata APIs..."
        begin
          metadata_extractor = ArticleMetadataExtractor.new(doi)
          metadata = metadata_extractor.extract
        rescue => e
          Rails.logger.warn "DOI-based extraction failed: #{e.message}"
          metadata = nil
        end
      end

      # If no DOI found or DOI lookup failed, try LLM extraction from PDF text
      if metadata.nil?
        Rails.logger.info "DOI lookup failed or no DOI found, trying LLM extraction from PDF text..."
        pdf_text = extractor.extracted_text

        if pdf_text.present? && pdf_text.length > 100
          metadata = ArticleMetadataExtractor.extract_from_pdf_text(pdf_text)
        end

        if metadata.nil?
          render json: {
            error: 'Could not extract metadata from PDF. Please enter metadata manually.',
            doi_found: doi.present?,
            extracted_doi: doi
          }, status: :unprocessable_entity
          return
        end

        # Mark that this came from LLM extraction
        metadata['extraction_method'] = 'llm'
      else
        metadata['extraction_method'] = 'doi_api'
      end

      render json: metadata.merge(extracted_doi: doi)
    rescue => e
      Rails.logger.error "PDF extraction error: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
      render json: { error: "Failed to extract metadata: #{e.message}" }, status: :unprocessable_entity
    end
  end

  # POST /sources/suggest_authors
  # Body: { title:, abstract:, doi: }
  # Returns: { authors: [{given, family, orcid}], source: 'crossref'|'haiku'|'none' }
  def suggest_authors
    title = params[:title].to_s.strip
    if title.blank?
      render json: { error: 'Title is required' }, status: :unprocessable_entity
      return
    end

    result = AuthorSuggestionService.new(
      title: title,
      abstract: params[:abstract],
      doi: params[:doi]
    ).suggest

    render json: result
  end

  # POST /sources/tag_research_types
  # Body: { title:, abstract:, summary:, kind: }
  # Returns: { types: [...] } — a list of methodology tags drawn from the
  # controlled RESEARCH_TYPES vocabulary.  Does not persist; the frontend
  # merges into the form and saves through the normal flow.
  def tag_research_types
    title = params[:title].to_s.strip

    if title.blank?
      render json: { error: 'Title is required' }, status: :unprocessable_entity
      return
    end

    types = ResearchTypeTagger.new(
      title: title,
      abstract: params[:abstract],
      summary: params[:summary],
      kind: params[:kind]
    ).tag

    render json: { types: types }
  end

  # POST /sources/tag_statistical_tests
  # Body: { title:, abstract:, summary:, kind:, source_id?, include_pdf? }
  # Returns: { tests: [{id, name, slug}], used_pdf: bool, eligible_for_pdf: bool }
  #   - tests:            canonical StatisticalTest records the LLM identified
  #   - used_pdf:         true if this call actually fed PDF text to Haiku
  #   - eligible_for_pdf: true if the source has a PDF + an empirical kind, so
  #                       the frontend knows whether a PDF retry is worth offering
  #
  # When source_id is present, persists statistical_tests_searched_at on the
  # source after each call so the UI can render "Searched, no tests found"
  # without re-fetching.
  def tag_statistical_tests
    title = params[:title].to_s.strip
    if title.blank?
      render json: { error: 'Title is required' }, status: :unprocessable_entity
      return
    end

    source = nil
    if params[:source_id].present?
      source = Source.find_by(id: params[:source_id])
      if source.nil? || !source.shared_with?(current_user)
        head :forbidden
        return
      end
    end

    include_pdf = ActiveModel::Type::Boolean.new.cast(params[:include_pdf])
    pdf_text = nil
    used_pdf = false

    if include_pdf && source&.likely_describes_statistical_tests?
      pdf_text = extract_source_pdf_text(source)
      used_pdf = pdf_text.present?
    end

    tests = StatisticalTestTagger.new(
      title: title,
      abstract: params[:abstract],
      summary: params[:summary],
      kind: params[:kind],
      pdf_text: pdf_text
    ).tag

    # Persist a "we tried" timestamp so the UI can stop nagging users to
    # click again on sources we already searched.
    source&.update_columns(statistical_tests_searched_at: Time.current)

    render json: {
      tests: tests.map { |t| { id: t.id, name: t.name, slug: t.slug } },
      used_pdf: used_pdf,
      eligible_for_pdf: source&.likely_describes_statistical_tests? || false
    }
  end

  # POST /sources/flesh_out_citation
  # Body: { fragment: "Smith et al. 2021 attention is all you need" | "10.1038/..." }
  # Resolves a free-form fragment to a full bibliographic record using
  # Crossref + OpenAlex, with Haiku for parsing and disambiguation.
  # Returns: { best: {...source fields...}, alternatives: [...], confidence: 'high'|'medium'|'low' }
  # On failure: { error: ... } with 422.
  def flesh_out_citation
    fragment = params[:fragment].to_s.strip
    if fragment.length < 4
      render json: { error: 'Provide at least a few characters to search for.' }, status: :unprocessable_entity
      return
    end

    result = CitationResolver.resolve(fragment)
    if result[:ok]
      render json: {
        best: result[:best],
        alternatives: result[:alternatives],
        confidence: result[:confidence]
      }
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end

  # POST /sources/citations
  # Body: { ids: [1,2,3], format: 'apa' }
  # Returns formatted citations for the requested sources in the chosen style.
  def citations
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Source)
    ids = Array(params[:ids]).map(&:to_i).reject(&:zero?) & accessible_ids
    format = params[:format].to_s.downcase

    unless CitationFormatter::FORMATS.include?(format)
      render json: { error: 'Unsupported format' }, status: :unprocessable_entity
      return
    end

    sources = Source.where(id: ids).includes(:source_authors, :authors)
    sources_by_id = sources.index_by(&:id)
    ordered = ids.map { |id| sources_by_id[id] }.compact

    body = CitationFormatter.render_list(ordered, format)
    render json: { format: format, count: ordered.length, body: body }
  end

  private

  def set_source
    @source = Source.find(params[:id])
    head :forbidden unless @source.shared_with?(current_user)
  end

  def serialize_statistical_tests(source)
    source.source_statistical_tests.includes(:statistical_test).map do |link|
      t = link.statistical_test
      {
        id: t.id,
        name: t.name,
        slug: t.slug,
        confidence: link.confidence,
        detected_automatically: link.detected_automatically,
        notes: link.notes
      }
    end
  end

  # Pulls plain text out of the source's PDF for LLM context. Returns "" on
  # any failure — the caller decides whether to escalate or skip.
  def extract_source_pdf_text(source)
    return '' unless source.pdf.attached?
    source.pdf.open do |file|
      PdfTextExtractor.new(file).extracted_text.to_s
    end
  rescue => e
    Rails.logger.warn "PDF text extraction failed for source #{source.id}: #{e.message}"
    ''
  end

  def authorize_edit!
    head :forbidden unless @source.editable_by?(current_user)
  end

  def parse_and_link_authors(source, authors_string, processed_authors = nil)
    return if authors_string.blank?

    # Remove existing person associations for this source
    source.person_sources.destroy_all

    # If we have processed author data from the disambiguation modal, use that
    if processed_authors.present?
      processed_authors.each do |author_data|
        if author_data['action'] == 'link' || author_data['action'] == 'link_and_update'
          # Link to existing person
          person = current_user.people.find_by(id: author_data['linkedPersonId'])
          if person && !source.people.include?(person)
            source.people << person

            # Handle mergeOrcid - add ORCID from ORCID registry to existing person
            if author_data['mergeOrcid'].present? && person.orcid.blank?
              person.update(orcid: author_data['mergeOrcid'])
              Rails.logger.info "Added ORCID #{author_data['mergeOrcid']} to existing person #{person.id}"
            # Update person with ORCID from CrossRef if they don't have one
            elsif author_data['orcid'].present? && person.orcid.blank?
              person.update(orcid: author_data['orcid'])
            end
          end
        else
          # Create new person with enriched data from disambiguation modal
          first = author_data['firstName']&.strip
          middle = author_data['middleName']&.strip
          last = author_data['lastName']&.strip
          orcid = author_data['orcid']&.strip

          # Combine first and middle into first_name field
          # Handle initials - add period if single letter
          first = "#{first}." if first.present? && first.length == 1
          middle = "#{middle}." if middle.present? && middle.length == 1

          first_name_combined = [first, middle].compact.reject(&:blank?).join(' ')

          person = current_user.people.create!(
            first_name: first_name_combined.presence,
            last_name: last,
            orcid: orcid.presence,
            role: 'researcher'
          )

          source.people << person unless source.people.include?(person)
        end
      end
    else
      # Fallback: Simple auto-parse (original behavior)
      authors = authors_string.split(/\.\s*,\s*(?=[A-Z])/)

      authors.each do |author_name|
        original_name = author_name.strip
        original_name += '.' unless original_name.end_with?('.')

        # Convert "Last, First" to "First Last" format
        if original_name.include?(',')
          parts = original_name.split(',').map(&:strip)
          full_name = "#{parts[1]} #{parts[0]}"
        else
          full_name = original_name
        end

        # Try to find existing person by searching both formats
        last_name = parts ? parts[0] : original_name.split.last
        person = current_user.people.where("full_name ILIKE ? OR full_name ILIKE ?",
                                           "%#{last_name}%",
                                           "#{last_name},%").first

        unless person
          person = current_user.people.create!(
            full_name: full_name,
            role: 'researcher'
          )
        end

        source.people << person unless source.people.include?(person)
      end
    end
  end

  def source_params
    params.require(:source).permit(
      :title,
      :authors,
      :year,
      :kind,
      :publisher_or_venue,
      :doi,
      :url,
      :citation,
      :summary,
      :journal_name,
      :volume,
      :issue,
      :pages,
      :publication_date,
      :abstract,
      :book_title,
      :edition,
      :isbn,
      :chapter_number,
      :website_name,
      :access_date,
      :formatted_citation,
      :pdf,
      :processed_authors,
      :override_authors,
      tags: [],
      methodologies: [],
      keywords: [],
      markers: [],
      concept_ids: [],
      person_ids: [],
      collection_ids: [],
      statistical_test_ids: []
    )
  end

  def truthy?(v)
    %w[1 true yes on].include?(v.to_s.downcase)
  end

  # Apply all incoming filter params to a Source scope.  Each filter narrows
  # the set; combinations AND together.  q does a text search across the
  # most useful fields.
  def apply_filters(scope, q:, kind:, concept_ids:, person_ids:, tag_names:, collection_ids:, markers:, methodologies:, year_min:, year_max:, has_pdf:, has_notes:, owner_id:)
    s = scope

    if q.present?
      pattern = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"
      s = s.where(
        "title ILIKE :p OR authors ILIKE :p OR summary ILIKE :p OR abstract ILIKE :p OR doi ILIKE :p OR journal_name ILIKE :p",
        p: pattern
      )
    end

    s = s.where(kind: kind) if kind.present?
    s = s.where("year >= ?", year_min) if year_min
    s = s.where("year <= ?", year_max) if year_max

    if concept_ids.any?
      sub = ConceptSource.where(concept_id: concept_ids).select(:source_id)
      s = s.where(id: sub)
    end

    if person_ids.any?
      sub = PersonSource.where(person_id: person_ids).select(:source_id)
      s = s.where(id: sub)
    end

    if tag_names.any?
      tag_ids = Tag.where(user_id: owner_id, name: tag_names).pluck(:id)
      sub = Tagging.where(taggable_type: 'Source', tag_id: tag_ids).select(:taggable_id)
      s = s.where(id: sub)
    end

    if collection_ids.any?
      sub = CollectionItem.where(collectable_type: 'Source', collection_id: collection_ids).select(:collectable_id)
      s = s.where(id: sub)
    end

    if markers.any?
      s = s.where("markers && ARRAY[?]::text[]", markers)
    end

    # Methodologies live in a JSON array column, so use json_array_elements_text
    # to test membership.  Slow if the library is huge but fine for typical
    # researcher libraries; can migrate to a text array with a GIN index later.
    if methodologies.any?
      s = s.where(
        "sources.methodologies IS NOT NULL AND EXISTS (SELECT 1 FROM json_array_elements_text(sources.methodologies) m WHERE m = ANY (ARRAY[?]))",
        methodologies
      )
    end

    if has_pdf
      pdf_ids = ActiveStorage::Attachment.where(record_type: 'Source', name: 'pdf').select(:record_id)
      s = s.where(id: pdf_ids)
    end

    if has_notes
      noted_ids = Note.where.not(source_id: nil).select(:source_id)
      s = s.where(id: noted_ids)
    end

    s
  end

  # Faceted filter metadata.  Returns counts and option lists so the
  # frontend sidebar can render checkboxes with live numbers.  Counts are
  # computed against the user's full accessible library (not the filtered
  # set) — this matches the typical faceted-search pattern where you
  # always see what's available across the whole space.
  def build_filter_facets(base_scope, accessible_ids, applied:)
    kinds = base_scope.reorder(nil).group(:kind).count.transform_keys(&:to_s).reject { |k, _| k.blank? }
    years = base_scope.reorder(nil).where.not(year: nil).group(:year).count

    # Author counts — per-Person source count across the user's library.
    author_counts = PersonSource
      .where(source_id: accessible_ids)
      .group(:person_id)
      .count
    authors = Person.where(id: author_counts.keys)
                    .pluck(:id, :full_name)
                    .map { |id, name| { id: id, full_name: name, count: author_counts[id] || 0 } }
                    .sort_by { |p| p[:full_name].to_s.downcase }

    # Concept counts — sources tagged with each concept across the library.
    concept_counts = ConceptSource
      .where(source_id: accessible_ids)
      .group(:concept_id)
      .count
    concepts = Concept.where(id: concept_counts.keys)
                      .pluck(:id, :label)
                      .map { |id, label| { id: id, label: label, count: concept_counts[id] || 0 } }
                      .sort_by { |c| c[:label].to_s.downcase }

    # Tag counts — sources carrying each tag.
    owned_ids = base_scope.where(user_id: current_user.id).pluck(:id)
    tag_id_counts = Tagging
      .where(taggable_type: 'Source', taggable_id: owned_ids)
      .group(:tag_id)
      .count
    tag_rows = Tag.where(id: tag_id_counts.keys).pluck(:id, :name)
    tags = tag_rows
      .map { |id, name| { name: name, count: tag_id_counts[id] || 0 } }
      .sort_by { |t| t[:name].to_s.downcase }

    # Collection counts — sources placed in each collection.
    coll_counts = CollectionItem
      .where(collectable_type: 'Source', collectable_id: accessible_ids)
      .group(:collection_id)
      .count
    collections = Collection.where(id: coll_counts.keys)
                            .pluck(:id, :name)
                            .map { |id, name| { id: id, name: name, count: coll_counts[id] || 0 } }
                            .sort_by { |c| c[:name].to_s.downcase }

    pdf_count = ActiveStorage::Attachment.where(record_type: 'Source', record_id: accessible_ids, name: 'pdf').count
    notes_count = Note.where(source_id: accessible_ids).distinct.count(:source_id)

    # Markers: union of suggested defaults + whatever the user has applied.
    # Counts come from a single pluck of all marker arrays; tally per token.
    raw_marker_lists = base_scope.reorder(nil).where("markers IS NOT NULL").pluck(:markers)
    marker_counts = Hash.new(0)
    raw_marker_lists.each do |list|
      Array(list).each { |m| marker_counts[m] += 1 if m.present? }
    end
    suggested = Source::SUGGESTED_MARKERS
    marker_names = (suggested + marker_counts.keys).uniq
    markers_list = marker_names
      .map { |name| { name: name, count: marker_counts[name] || 0 } }
      .sort_by { |m| m[:name].to_s.downcase }

    # Methodologies: same shape as markers.  Pluck once, tally in Ruby.
    raw_method_lists = base_scope.reorder(nil).where("methodologies IS NOT NULL").pluck(:methodologies)
    method_counts = Hash.new(0)
    raw_method_lists.each do |list|
      Array(list).each { |m| method_counts[m] += 1 if m.present? }
    end
    methodologies_list = method_counts
      .map { |name, count| { name: name, count: count } }
      .sort_by { |m| m[:name].to_s.downcase }

    {
      kinds: kinds.sort_by { |k, _| k }.map { |k, c| { value: k, count: c } },
      years: years.sort.map { |y, c| { value: y, count: c } },
      authors: authors,
      concepts: concepts,
      tags: tags,
      collections: collections,
      markers: markers_list,
      methodologies: methodologies_list,
      pdf_count: pdf_count,
      notes_count: notes_count,
      total: base_scope.count,
    }
  end
end
