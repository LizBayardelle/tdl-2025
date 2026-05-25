class BibliographyEntriesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_collection
  before_action :set_entry, only: [:update, :destroy]

  # Citation styles offered by the annotated-bibliography export.
  EXPORT_CITATION_STYLES = %w[apa chicago mla].freeze

  # GET /collections/:collection_id/bibliography_entries
  # One fetch backing the whole page: every annotation entry plus the
  # collection's sources, so the client can derive the un-annotated sidebar.
  # Entries are scoped to sources still in the collection — pulling a source
  # out hides its entry without destroying the annotation, so re-adding the
  # source later brings the annotation back.
  def index
    source_ids = @collection.sources.pluck(:id)
    entries = @collection.bibliography_entries
      .where(source_id: source_ids)
      .order(:created_at)
    sources = Source.where(id: source_ids).with_attached_pdf

    @source_grouping_ids = @collection.collection_items
      .where(collectable_type: 'Source', collectable_id: source_ids)
      .pluck(:collectable_id, :grouping_id).to_h

    groupings_payload = @collection.groupings.map do |g|
      { id: g.id, name: g.name, position: g.position }
    end

    with_citations = params[:with_citations].present?

    render json: {
      is_owner: owner?,
      can_edit: can_edit?,
      groupings: groupings_payload,
      entries: entries.map { |e| serialize_entry(e) },
      sources: sources.map { |s| serialize_source(s, with_citation: with_citations) }
    }
  end

  # POST /collections/:collection_id/bibliography_entries
  # Body: { source_id: }. Promotes a source from the sidebar into the entry
  # list. The internal annotation is prefilled (owner only) from the source's
  # running take in any other collection so jokes aren't rewritten.
  def create
    authorize_edit!

    source = @collection.sources.find_by(id: params[:source_id])
    unless source
      render json: { error: 'That source is not in this collection.' }, status: :unprocessable_entity
      return
    end

    entry = @collection.bibliography_entries.find_or_initialize_by(source_id: source.id)
    if entry.new_record?
      if owner?
        entry.internal_annotation = source.latest_internal_annotation(except_collection_id: @collection.id)
      end
      entry.save!
    end

    render json: serialize_entry(entry), status: :created
  end

  # PATCH /collections/:collection_id/bibliography_entries/:id
  # Collaborators may edit the formal annotation. The internal annotation is
  # owner-only on every path — non-owners can neither read nor write it.
  def update
    authorize_edit!

    permitted = params.require(:bibliography_entry)
    attrs = {}
    attrs[:formal_annotation]   = permitted[:formal_annotation]   if permitted.key?(:formal_annotation)
    attrs[:internal_annotation] = permitted[:internal_annotation] if owner? && permitted.key?(:internal_annotation)

    if @entry.update(attrs)
      render json: serialize_entry(@entry)
    else
      render json: { errors: @entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /collections/:collection_id/bibliography_entries/:id
  def destroy
    authorize_edit!
    @entry.destroy
    head :no_content
  end

  private

  def set_collection
    @collection = Collection.find(params[:collection_id])
    head :forbidden unless @collection.shared_with?(current_user)
  end

  def set_entry
    @entry = @collection.bibliography_entries.find(params[:id])
  end

  def owner?
    @collection.user_id == current_user.id
  end

  def can_edit?
    @collection.collaboratable_by?(current_user)
  end

  def authorize_edit!
    head :forbidden unless can_edit?
  end

  # Internal annotation is dropped entirely for non-owners — it never leaves
  # the server for anyone but the collection owner.
  def serialize_entry(entry)
    data = {
      id: entry.id,
      source_id: entry.source_id,
      formal_annotation: entry.formal_annotation
    }
    data[:internal_annotation] = entry.internal_annotation if owner?
    data
  end

  def serialize_source(source, with_citation: false)
    data = {
      id: source.id,
      title: source.title,
      authors: source.authors_string,
      year: source.year,
      kind: source.kind,
      grouping_id: @source_grouping_ids && @source_grouping_ids[source.id],
      pdf_url: source.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(source.pdf, only_path: true) : nil,
      pdf_filename: source.pdf.attached? ? source.pdf.filename.to_s : nil
    }
    if with_citation
      data[:abstract] = source.abstract
      data[:citations] = EXPORT_CITATION_STYLES.index_with { |style| citation(source, style) }
    end
    data
  end

  # Formatted reference string for the export, with a graceful fallback so
  # one malformed source can't 500 the whole bibliography.
  def citation(source, style)
    CitationFormatter.render(source, style)
  rescue => e
    Rails.logger.warn "#{style} citation failed for source #{source.id}: #{e.message}"
    [source.authors_string.presence, source.year && "(#{source.year}).", "#{source.title}."].compact.join(' ')
  end
end
