class NotesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_note, only: [:show, :edit, :update, :destroy]
  before_action :authorize_edit!, only: [:edit, :update, :destroy]

  # GET /notes
  # GET /notes.json
  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Note)
    @notes = Note.where(id: accessible_ids).includes(:concept, :source, :linked_sources, :people, :tags, :collections)

    # Filter by note type
    @notes = @notes.by_type(params[:note_type]) if params[:note_type].present?

    # Filter by concept
    @notes = @notes.for_concept(params[:concept_id]) if params[:concept_id].present?

    # Filter by source — notes can attach to many sources via note_sources;
    # match if the requested source is in the join (covers both primary and
    # additional attachments).
    if params[:source_id].present?
      @notes = @notes.joins(:note_sources).where(note_sources: { source_id: params[:source_id] }).distinct
    end

    # Filter by person — notes ↔ people through person_notes.
    if params[:person_id].present?
      @notes = @notes.joins(:person_notes).where(person_notes: { person_id: params[:person_id] }).distinct
    end

    # Filter by pinned
    @notes = @notes.pinned if params[:pinned] == 'true'

    # Filter for unattached notes
    @notes = @notes.unattached if params[:unattached] == 'true'

    @notes = @notes.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @notes.map { |note|
          is_owner = note.user_id == current_user.id
          note.as_json(include: {
            concepts: { only: [:id, :label, :concept_type] },
            source: { only: [:id, :title, :authors, :year] },
            people: { only: [:id, :full_name, :role] },
            tags: is_owner ? { only: [:id, :name] } : { only: [] },
            collections: { only: [:id, :name] }
          }).merge(
            tags: is_owner ? note.tags.as_json(only: [:id, :name]) : [],
            source_ids: note.linked_sources.map(&:id),
            linked_sources: note.linked_sources.map { |s| { id: s.id, title: s.title, year: s.year } },
            permission: note.permission_for(current_user),
            is_owner: is_owner
          )
        }
      }
    end
  end

  # GET /notes/new
  def new
    @note = current_user.notes.build
  end

  # GET /notes/:id/edit
  def edit
  end

  # GET /notes/:id
  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @note.as_json(include: {
          concepts: { only: [:id, :label, :concept_type, :summary] },
          source: { only: [:id, :title, :authors, :year] },
          people: { only: [:id, :full_name, :role] },
          tags: { only: [:id, :name] }
        }).merge(
          source_ids: @note.linked_sources.map(&:id),
          linked_sources: @note.linked_sources.map { |s| { id: s.id, title: s.title, year: s.year } }
        )
      }
    end
  end

  # POST /notes
  def create
    tags_array = params[:note][:tags]
    person_ids = params[:note][:person_ids]
    source_ids = params[:note][:source_ids]
    # Sources discovered via "Summarize & Wire In" come in as cited_source_ids
    # (a sidecar param the Highlight also reads).  Treat them as additional
    # note attachments so the new sources actually show up linked to the note.
    cited_ids = params[:note][:cited_source_ids]
    source_ids = (Array(source_ids) + Array(cited_ids)) if cited_ids.present?
    concept_ids = params[:note][:concept_ids]
    collection_ids = params[:note][:collection_ids]

    attrs = note_params.except(:tags, :person_ids, :source_ids, :concept_ids, :collection_ids)
    # Pick a primary source up front so the singular source_id stays in sync
    # with the multi-attachment join. If the form sent only source_ids[], use
    # the first; if it sent both, keep an explicit source_id wins.
    if attrs[:source_id].blank? && source_ids.is_a?(Array)
      first_id = source_ids.find(&:present?)
      attrs[:source_id] = first_id if first_id
    end
    @note = current_user.notes.build(attrs)
    @note.quote_bounds = quote_bounds_param if params[:note].key?(:quote_bounds)

    if @note.save
      # Handle tags
      @note.tag_list = tags_array unless tags_array.nil?

      auth = AuthorizationService.new(current_user)

      # Handle person associations.  Recipients of shared collections
      # need to be able to attach notes to people they don't own, so we
      # gate on accessible_ids rather than current_user.people.
      if person_ids.present?
        accessible = auth.accessible_ids(Person).to_set
        person_ids.each do |person_id|
          next if person_id.blank?
          pid = person_id.to_i
          next unless accessible.include?(pid)
          person = Person.find_by(id: pid)
          if person && !@note.people.include?(person)
            PersonNote.create!(person: person, note: @note, rel_type: 'mentioned')
          end
        end
      end

      # Handle concept associations (M:N).  Same logic — recipient can
      # link a note to any concept they have view access to.
      if concept_ids.present?
        accessible = auth.accessible_ids(Concept).to_set
        concept_ids.each do |concept_id|
          next if concept_id.blank?
          cid = concept_id.to_i
          next unless accessible.include?(cid)
          concept = Concept.find_by(id: cid)
          ConceptNote.create!(concept: concept, note: @note) if concept
        end
      end

      # Multi-source attachments
      sync_note_sources(@note, source_ids)

      sync_collections(@note, collection_ids)
      sync_highlight_for(@note)

      respond_to do |format|
        format.html { redirect_to notes_path, notice: 'Note created successfully.' }
        format.json { render json: serialize_note(@note), status: :created }
      end
    else
      respond_to do |format|
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: { errors: @note.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /notes/:id
  def update
    tags_array = params[:note][:tags]
    person_ids = params[:note][:person_ids]
    source_ids = params[:note][:source_ids]
    cited_ids = params[:note][:cited_source_ids]
    concept_ids = params[:note][:concept_ids]
    collection_ids = params[:note][:collection_ids]

    attrs = note_params.except(:tags, :person_ids, :source_ids, :concept_ids, :collection_ids)
    # Keep singular source_id in sync with the multi-source list. If the form
    # only sent source_ids[], compute the primary from it; if neither came
    # through, leave the existing source_id alone.
    if !attrs.key?(:source_id) && params[:note].key?(:source_ids)
      first_id = source_ids.is_a?(Array) ? source_ids.find(&:present?) : nil
      attrs[:source_id] = first_id
    end

    if @note.update(attrs)
      @note.update_column(:quote_bounds, quote_bounds_param) if params[:note].key?(:quote_bounds)
      # Handle tags
      @note.tag_list = tags_array unless tags_array.nil?

      auth = AuthorizationService.new(current_user)

      # Handle person associations — only when the form actually sent
      # person_ids.  Partial updates (e.g., a pinned-only PATCH) must
      # NOT destroy the existing person links.  Gate on accessible_ids
      # so recipients can attach notes to shared people.
      if params[:note].key?(:person_ids)
        accessible = auth.accessible_ids(Person).to_set
        @note.person_notes.destroy_all
        Array(person_ids).each do |person_id|
          next if person_id.blank?
          pid = person_id.to_i
          next unless accessible.include?(pid)
          person = Person.find_by(id: pid)
          PersonNote.create!(person: person, note: @note, rel_type: 'mentioned') if person
        end
      end

      # Handle concept associations (M:N) — same rule.  A partial PATCH
      # without concept_ids leaves the existing concept_notes alone.
      if params[:note].key?(:concept_ids)
        accessible = auth.accessible_ids(Concept).to_set
        @note.concept_notes.destroy_all
        Array(concept_ids).each do |concept_id|
          next if concept_id.blank?
          cid = concept_id.to_i
          next unless accessible.include?(cid)
          concept = Concept.find_by(id: cid)
          ConceptNote.create!(concept: concept, note: @note) if concept
        end
      end

      # Multi-source attachments — only resync if the form sent source_ids[],
      # so callers that PATCH partial updates (autosave on a body edit) don't
      # blow away the link list.  When source_ids is sent, merge in any
      # cited_source_ids (wire-in path) so they're preserved.  When only
      # cited_source_ids comes through, add them non-destructively.
      if params[:note].key?(:source_ids)
        merged = Array(source_ids) + Array(cited_ids)
        sync_note_sources(@note, merged)
      elsif cited_ids.present?
        existing_ids = @note.linked_sources.pluck(:id)
        sync_note_sources(@note, existing_ids + Array(cited_ids))
      end

      sync_collections(@note, collection_ids) unless collection_ids.nil?
      sync_highlight_for(@note)

      respond_to do |format|
        format.html { redirect_to notes_path, notice: 'Note updated successfully.' }
        format.json { render json: serialize_note(@note) }
      end
    else
      respond_to do |format|
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: { errors: @note.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /notes/:id
  def destroy
    @note.destroy
    head :no_content
  end

  private

  def set_note
    @note = Note.find(params[:id])
    head :forbidden unless @note.shared_with?(current_user)
  end

  def authorize_edit!
    head :forbidden unless @note.editable_by?(current_user)
  end

  # Sync the multi-source join. Always include the primary source_id (set
  # on the note row) so the join stays consistent with the singular
  # column.  Filters against accessible_ids rather than owned-only so a
  # recipient can attach notes to sources shared via a collection.
  def sync_note_sources(note, source_ids)
    ids = Array(source_ids).map(&:to_i).reject(&:zero?)
    ids << note.source_id if note.source_id.present?
    ids = ids.uniq
    accessible = AuthorizationService.new(current_user).accessible_ids(Source)
    valid_ids = ids & accessible
    note.note_sources.where.not(source_id: valid_ids).destroy_all
    valid_ids.each do |sid|
      NoteSource.find_or_create_by!(note: note, source_id: sid)
    end
  end

  # Note JSON shared between create/update. Keeps the singular `source` block
  # for backward compat with displays that show a primary source, and adds
  # `source_ids` (and a richer `linked_sources`) for the multi-attachment UI.
  # Each linkable chip carries an `accessible` flag so the UI can render
  # revoked-access entries as muted, non-clickable placeholders rather
  # than 403-on-click links.
  def serialize_note(note)
    auth = AuthorizationService.new(current_user)
    a_concepts = auth.accessible_ids(Concept).to_set
    a_sources  = auth.accessible_ids(Source).to_set
    a_people   = auth.accessible_ids(Person).to_set

    json = note.as_json(only: [
      :id, :title, :body, :note_type, :context, :pinned, :noted_on,
      :page_number, :quote_text, :source_id, :user_id, :created_at, :updated_at,
    ])

    json['concepts'] = note.concepts.map do |c|
      { id: c.id, label: c.label, concept_type: c.concept_type,
        accessible: a_concepts.include?(c.id) }
    end
    json['people'] = note.people.map do |p|
      { id: p.id, full_name: p.full_name, role: p.role,
        accessible: a_people.include?(p.id) }
    end
    json['source'] = note.source && {
      id: note.source.id, title: note.source.title,
      authors: note.source.authors, year: note.source.year,
      accessible: a_sources.include?(note.source.id),
    }
    json['linked_sources'] = note.linked_sources.map do |s|
      { id: s.id, title: s.title, year: s.year,
        accessible: a_sources.include?(s.id) }
    end
    json['source_ids'] = note.linked_sources.pluck(:id)
    json['tags'] = note.tags.as_json(only: [:id, :name])
    json
  end

  def sync_collections(note, collection_ids)
    ids = Array(collection_ids).map(&:to_i).reject(&:zero?)
    note.collection_items.destroy_all
    return if ids.empty?
    Collection.where(id: ids).each do |collection|
      next unless collection.user_id == current_user.id || collection.shared_with?(current_user)
      CollectionItem.find_or_create_by!(collection: collection, collectable: note)
    end
  end

  # Maintain a Highlight record alongside any note that quotes a passage from
  # a PDF source.  We re-sync on every save so editing the quote updates the
  # underlying highlight position; clearing the quote drops the highlight.
  # Optional sidecar param `cited_source_ids` attaches sources extracted from
  # a bibliography selection so the highlight can render its blue stripe.
  def sync_highlight_for(note)
    needs_highlight = note.source_id.present? &&
                      note.page_number.present? &&
                      note.quote_text.present?

    if needs_highlight
      hl = note.highlight || current_user.highlights.build(note: note)
      hl.source_id    = note.source_id
      hl.page_number  = note.page_number
      hl.text_content = note.quote_text
      hl.bounds       = note.quote_bounds

      cited = params.dig(:note, :cited_source_ids)
      if cited.present?
        ids = Array(cited).map(&:to_i).reject(&:zero?)
        valid_ids = current_user.sources.where(id: ids).pluck(:id)
        hl.cited_source_ids = (Array(hl.cited_source_ids) + valid_ids).uniq
      end

      hl.save
    elsif note.highlight
      note.highlight.destroy
    end
  end

  def quote_bounds_param
    raw = params[:note][:quote_bounds]
    return nil if raw.blank?
    case raw
    when Array
      raw.map { |r| r.respond_to?(:to_unsafe_h) ? r.to_unsafe_h : r }
    else
      raw.respond_to?(:to_unsafe_h) ? raw.to_unsafe_h : raw
    end
  end

  def note_params
    params.require(:note).permit(
      :title,
      :body,
      :note_type,
      :context,
      :pinned,
      :noted_on,
      :concept_id,
      :source_id,
      :page_number,
      :quote_text,
      tags: [],
      collection_ids: [],
      person_ids: [],
      source_ids: [],
      concept_ids: []
    )
  end
end
