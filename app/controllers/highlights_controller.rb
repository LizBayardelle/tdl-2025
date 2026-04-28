class HighlightsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_highlight, only: [:update, :destroy]

  # GET /highlights.json?source_id=1
  def index
    @highlights = current_user.highlights

    if params[:source_id].present?
      @highlights = @highlights.for_source(params[:source_id])
    end

    if params[:page_number].present?
      @highlights = @highlights.for_page(params[:page_number])
    end

    @highlights = @highlights.includes(note: [:concepts, :people])

    render json: @highlights.map { |h|
      n = h.note
      cited_ids = Array(h.cited_source_ids)
      {
        id: h.id,
        page_number: h.page_number,
        text_content: h.text_content,
        color_hex: h.color_hex,
        bounds: h.bounds,
        source_id: h.source_id,
        note_id: n&.id,
        cited_source_ids: cited_ids,
        has_concept: n ? n.concepts.any? : false,
        has_person:  n ? n.people.any?   : false,
        has_cited_source: cited_ids.any?
      }
    }
  end

  # PATCH /highlights/:id  — primarily for attaching cited_source_ids
  def update
    if @highlight.update(highlight_update_params)
      render json: @highlight
    else
      render json: { errors: @highlight.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /highlights
  def create
    @highlight = current_user.highlights.build(highlight_params)

    if @highlight.save
      render json: @highlight, status: :created
    else
      render json: { errors: @highlight.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /highlights/:id
  def destroy
    @highlight.destroy
    head :no_content
  end

  private

  def set_highlight
    @highlight = current_user.highlights.find(params[:id])
  end

  def highlight_params
    params.require(:highlight).permit(:source_id, :page_number, :text_content, :color_hex, :bounds)
  end

  def highlight_update_params
    raw = params.require(:highlight).permit(:color_hex)
    if params[:highlight].key?(:cited_source_ids)
      ids = Array(params[:highlight][:cited_source_ids]).map(&:to_i).reject(&:zero?)
      raw[:cited_source_ids] = ids
    end
    raw
  end
end
