class SourcesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_source, only: [:show, :study, :notes, :update, :destroy]
  before_action :authorize_edit!, only: [:update, :destroy]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Source)
    @sources = Source.where(id: accessible_ids).recent

    respond_to do |format|
      format.html
      format.json {
        # Pagination params
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i
        per_page = [per_page, 100].min # Cap at 100

        # Get total count before pagination
        total_count = @sources.count

        # Apply pagination
        paginated_sources = @sources.offset((page - 1) * per_page).limit(per_page)
          .includes(:concepts, :tags, :people, :collections, :notes)
          .with_attached_pdf

        # Build paginated source data
        sources_data = paginated_sources.map { |source|
          is_owner = source.user_id == current_user.id
          source.as_json(only: [:id, :title, :authors, :year, :kind, :doi, :abstract, :summary]).merge(
            tags: is_owner ? source.tags.pluck(:name) : [],
            keywords: source[:keywords] || [],
            concept_ids: source.concept_ids,
            concepts: source.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            people: source.people.map { |p| { id: p.id, full_name: p.full_name } },
            collections: source.collections.map { |c| { id: c.id, name: c.name } },
            notes_count: source.notes.size,
            pdf_url: source.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(source.pdf, only_path: true) : nil,
            pdf_filename: source.pdf.attached? ? source.pdf.filename.to_s : nil,
            permission: source.permission_for(current_user),
            is_owner: is_owner
          )
        }

        # On first page, include filter metadata
        if page == 1
          # Aggregate filter data efficiently using separate queries
          # Use reorder(nil) to remove the default ordering before distinct
          kinds = @sources.reorder(nil).distinct.pluck(:kind).compact.sort
          years = @sources.reorder(nil).distinct.pluck(:year).compact.sort

          # Get authors (people linked to sources)
          people_ids = PersonSource.where(source_id: accessible_ids).distinct.pluck(:person_id)
          authors = Person.where(id: people_ids).pluck(:id, :full_name).map { |id, name| { id: id, full_name: name } }.sort_by { |p| p[:full_name] }

          # Get tags (only from owned sources)
          owned_source_ids = @sources.where(user_id: current_user.id).pluck(:id)
          tag_ids = Tagging.where(taggable_type: 'Source', taggable_id: owned_source_ids).distinct.pluck(:tag_id)
          tags = Tag.where(id: tag_ids).pluck(:name).sort

          # Get collections
          collection_ids = CollectionItem.where(collectable_type: 'Source', collectable_id: accessible_ids).distinct.pluck(:collection_id)
          collections = Collection.where(id: collection_ids).pluck(:id, :name).map { |id, name| { id: id, name: name } }.sort_by { |c| c[:name] }

          # Count PDFs
          pdf_count = ActiveStorage::Attachment.where(record_type: 'Source', record_id: accessible_ids, name: 'pdf').count

          render json: {
            sources: sources_data,
            pagination: {
              page: page,
              per_page: per_page,
              total_count: total_count,
              total_pages: (total_count.to_f / per_page).ceil
            },
            filters: {
              kinds: kinds,
              years: years,
              authors: authors,
              tags: tags,
              collections: collections,
              pdf_count: pdf_count
            }
          }
        else
          render json: {
            sources: sources_data,
            pagination: {
              page: page,
              per_page: per_page,
              total_count: total_count,
              total_pages: (total_count.to_f / per_page).ceil
            }
          }
        end
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @source.as_json(
          include: {
            concepts: { only: [:id, :label, :node_type, :summary_top] },
            people: { only: [:id, :full_name, :role, :summary] },
            tags: { only: [:id, :name, :slug] },
            collections: { only: [:id, :name, :description] }
          }
        ).merge(
          concept_ids: @source.concept_ids,
          keywords: @source[:keywords] || [],
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
    @notes = @source.notes.order(created_at: :desc)
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
        created_at: note.created_at,
        updated_at: note.updated_at,
        source_id: note.source_id,
        concepts: note.concepts.map { |c| { id: c.id, label: c.label } },
        tags: note.tags
      }
    }
  end

  def create
    tags_array = params[:source][:tags]
    authors_string = params[:source][:authors]
    keywords_array = params[:source][:keywords]
    concept_ids = params[:source][:concept_ids]
    person_ids = params[:source][:person_ids]
    override_authors = params[:source][:override_authors]
    processed_authors = params[:source][:processed_authors]
    processed_authors = JSON.parse(processed_authors) if processed_authors.is_a?(String)

    source_params_clean = source_params.except(:tags, :authors, :keywords, :concept_ids, :person_ids, :override_authors, :processed_authors)

    @source = current_user.sources.build(source_params_clean)

    # Set keywords directly on column
    @source[:keywords] = keywords_array if keywords_array.present?

    if @source.save
      # Use Taggable concern for tags (creates Tag records)
      @source.tag_list = tags_array if tags_array.present?

      # Set concept associations
      @source.concept_ids = concept_ids if concept_ids.present?

      # Handle people associations
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          @source.people << person if person && !@source.people.include?(person)
        end
      end

      # Auto-generate authors from linked people unless override is enabled
      if override_authors == 'true' || override_authors == true
        @source[:authors] = authors_string if authors_string.present?
        parse_and_link_authors(@source, authors_string, processed_authors) if authors_string.present?
      elsif @source.people.any?
        @source[:authors] = @source.people.map(&:full_name).join(', ')
      end

      @source.save if @source.changed?

      render json: @source.as_json.merge(
        tags: @source.tags.pluck(:name),
        keywords: @source[:keywords] || [],
        concept_ids: @source.concept_ids
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
    override_authors = params[:source][:override_authors]
    processed_authors = params[:source][:processed_authors]
    processed_authors = JSON.parse(processed_authors) if processed_authors.is_a?(String)

    source_params_clean = source_params.except(:tags, :authors, :keywords, :concept_ids, :person_ids, :override_authors, :processed_authors)

    # Set keywords directly on column
    @source[:keywords] = keywords_array if keywords_array.present?

    if @source.update(source_params_clean)
      # Use Taggable concern for tags (creates Tag records)
      @source.tag_list = tags_array if tags_array.present?

      # Set concept associations
      @source.concept_ids = concept_ids if concept_ids.present?

      # Handle people associations
      @source.person_sources.destroy_all
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          @source.people << person if person
        end
      end

      # Auto-generate authors from linked people unless override is enabled
      if override_authors == 'true' || override_authors == true
        @source[:authors] = authors_string if authors_string.present?
        parse_and_link_authors(@source, authors_string, processed_authors) if authors_string.present?
      elsif @source.people.any?
        @source[:authors] = @source.people.map(&:full_name).join(', ')
      else
        @source[:authors] = nil
      end

      @source.save if @source.changed?

      render json: @source.as_json.merge(
        tags: @source.tags.pluck(:name),
        keywords: @source[:keywords] || [],
        concept_ids: @source.concept_ids
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

  private

  def set_source
    @source = Source.find(params[:id])
    head :forbidden unless @source.shared_with?(current_user)
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
        if author_data['action'] == 'link'
          # Link to existing person
          person = current_user.people.find_by(id: author_data['linkedPersonId'])
          source.people << person if person && !source.people.include?(person)
        else
          # Create new person with enriched data from disambiguation modal
          first = author_data['firstName']&.strip
          middle = author_data['middleName']&.strip
          last = author_data['lastName']&.strip

          # Combine first and middle into first_name field
          # Handle initials - add period if single letter
          first = "#{first}." if first.present? && first.length == 1
          middle = "#{middle}." if middle.present? && middle.length == 1

          first_name_combined = [first, middle].compact.reject(&:blank?).join(' ')

          person = current_user.people.create!(
            first_name: first_name_combined.presence,
            last_name: last,
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
      concept_ids: [],
      person_ids: []
    )
  end
end
