class NotesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_note, only: [:show, :update, :destroy]

  # GET /notes
  # GET /notes.json
  def index
    @notes = current_user.notes.includes(:node)

    # Filter by note type
    @notes = @notes.by_type(params[:note_type]) if params[:note_type].present?

    # Filter by node
    @notes = @notes.for_node(params[:node_id]) if params[:node_id].present?

    # Filter by pinned
    @notes = @notes.pinned if params[:pinned] == 'true'

    # Filter for unattached notes
    @notes = @notes.unattached if params[:unattached] == 'true'

    @notes = @notes.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @notes.as_json(include: {
          node: { only: [:id, :label, :node_type] }
        })
      }
    end
  end

  # GET /notes/:id
  def show
    render json: @note.as_json(include: {
      node: { only: [:id, :label, :node_type, :summary_top] }
    })
  end

  # POST /notes
  def create
    @note = current_user.notes.build(note_params)

    if @note.save
      render json: @note.as_json(include: {
        node: { only: [:id, :label, :node_type] }
      }), status: :created
    else
      render json: { errors: @note.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /notes/:id
  def update
    if @note.update(note_params)
      render json: @note.as_json(include: {
        node: { only: [:id, :label, :node_type] }
      })
    else
      render json: { errors: @note.errors.full_messages }, status: :unprocessable_entity
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
      :body,
      :note_type,
      :context,
      :pinned,
      :noted_on,
      :node_id,
      tags: []
    )
  end
end
