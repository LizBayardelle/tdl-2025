class SourcesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_source, only: [:show, :study, :notes, :update, :destroy]

  def index
    @sources = current_user.sources.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @sources.includes(:concepts, :tags, :people, :notes).map { |source|
          source.as_json.merge(
            tags: source.tags.pluck(:name),
            keywords: source[:keywords] || [],
            concept_ids: source.concept_ids,
            concepts: source.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            people: source.people.map { |p| { id: p.id, full_name: p.full_name } },
            notes_count: source.notes.count,
            pdf_url: source.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(source.pdf, only_path: true) : nil,
            pdf_filename: source.pdf.attached? ? source.pdf.filename.to_s : nil
          )
        }
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
            tags: { only: [:id, :name, :slug] }
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
    @source = current_user.sources.find(params[:id])
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
          # Create new person with enriched data
          # Build full name: "Last, First Middle" format
          last = author_data['lastName']&.strip
          first = author_data['firstName']&.strip
          middle = author_data['middleName']&.strip

          # Build name parts
          name_parts = []
          if last.present?
            name_parts << last
          end

          # Add first and middle initials/names
          initials = []
          if first.present?
            # Use first letter with period if it's just an initial, otherwise use full name
            initials << (first.length == 1 ? "#{first}." : first)
          end
          if middle.present?
            initials << (middle.length == 1 ? "#{middle}." : middle)
          end

          name_parts << initials.join(' ') if initials.any?

          full_name = name_parts.join(', ')

          # Fallback to original if parsing failed
          full_name = author_data['originalName'] if full_name.blank?

          person = current_user.people.create!(
            full_name: full_name,
            role: 'researcher'
          )

          source.people << person unless source.people.include?(person)
        end
      end
    else
      # Fallback: Simple auto-parse (original behavior)
      authors = authors_string.split(/\.\s*,\s*(?=[A-Z])/)

      authors.each do |author_name|
        full_name = author_name.strip
        full_name += '.' unless full_name.end_with?('.')

        last_name = full_name.split(',').first&.strip
        next if last_name.blank?

        person = current_user.people.where("full_name ILIKE ?", "#{last_name},%").first

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
