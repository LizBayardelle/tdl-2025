class HighlightsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_highlight, only: [:destroy]

  # GET /highlights.json?source_id=1
  def index
    @highlights = current_user.highlights

    if params[:source_id].present?
      @highlights = @highlights.for_source(params[:source_id])
    end

    if params[:page_number].present?
      @highlights = @highlights.for_page(params[:page_number])
    end

    render json: @highlights
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
end
