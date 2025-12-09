class NotesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_note, only: [:show, :edit, :update, :destroy]

  # GET /notes
  # GET /notes.json
  def index
    @notes = current_user.notes.includes(:concept, :source, :people, :tags)

    # Filter by note type
    @notes = @notes.by_type(params[:note_type]) if params[:note_type].present?

    # Filter by concept
    @notes = @notes.for_concept(params[:concept_id]) if params[:concept_id].present?

    # Filter by pinned
    @notes = @notes.pinned if params[:pinned] == 'true'

    # Filter for unattached notes
    @notes = @notes.unattached if params[:unattached] == 'true'

    @notes = @notes.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @notes.as_json(include: {
          concept: { only: [:id, :label, :node_type] },
          source: { only: [:id, :title, :authors, :year] },
          people: { only: [:id, :full_name, :role] },
          tags: { only: [:id, :name] }
        })
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
    render json: @note.as_json(include: {
      concept: { only: [:id, :label, :node_type, :summary_top] }
    })
  end

  # POST /notes
  def create
    tags_array = params[:note][:tags]
    person_ids = params[:note][:person_ids]
    source_ids = params[:note][:source_ids]

    @note = current_user.notes.build(note_params.except(:tags, :person_ids, :source_ids))

    if @note.save
      # Handle tags
      @note.tag_list = tags_array if tags_array.present?

      # Handle person associations
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          if person && !@note.people.include?(person)
            PersonNote.create!(person: person, note: @note, rel_type: 'mentioned')
          end
        end
      end

      # Handle source associations (note: source_id is singular, already handled in note_params)

      respond_to do |format|
        format.html { redirect_to notes_path, notice: 'Note created successfully.' }
        format.json {
          render json: @note.as_json(include: {
            concept: { only: [:id, :label, :node_type] }
          }), status: :created
        }
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

    if @note.update(note_params.except(:tags, :person_ids, :source_ids))
      # Handle tags
      @note.tag_list = tags_array if tags_array.present?

      # Handle person associations
      @note.person_notes.destroy_all
      if person_ids.present?
        person_ids.each do |person_id|
          next if person_id.blank?
          person = current_user.people.find_by(id: person_id)
          if person
            PersonNote.create!(person: person, note: @note, rel_type: 'mentioned')
          end
        end
      end

      respond_to do |format|
        format.html { redirect_to notes_path, notice: 'Note updated successfully.' }
        format.json {
          render json: @note.as_json(include: {
            concept: { only: [:id, :label, :node_type] }
          })
        }
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
    @note = current_user.notes.find(params[:id])
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
      tags: [],
      person_ids: [],
      source_ids: []
    )
  end
end
