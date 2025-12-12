class HighlightColorsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_highlight_color, only: [:update, :destroy]

  # GET /highlight_colors.json
  def index
    @highlight_colors = current_user.highlight_colors.order(:position)
    render json: @highlight_colors
  end

  # POST /highlight_colors
  def create
    @highlight_color = current_user.highlight_colors.build(highlight_color_params)

    if @highlight_color.save
      render json: @highlight_color, status: :created
    else
      render json: { errors: @highlight_color.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /highlight_colors/:id
  def update
    if @highlight_color.update(highlight_color_params)
      render json: @highlight_color
    else
      render json: { errors: @highlight_color.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /highlight_colors/:id
  def destroy
    @highlight_color.destroy
    head :no_content
  end

  # POST /highlight_colors/reorder
  def reorder
    params[:highlight_colors].each_with_index do |id, index|
      current_user.highlight_colors.find(id).update(position: index)
    end
    head :no_content
  end

  private

  def set_highlight_color
    @highlight_color = current_user.highlight_colors.find(params[:id])
  end

  def highlight_color_params
    params.require(:highlight_color).permit(:label, :color_hex, :position)
  end
end
