class SourcesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_source, only: [:show, :update, :destroy]

  def index
    @sources = current_user.sources.recent

    respond_to do |format|
      format.html
      format.json { render json: @sources.includes(:nodes) }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json { render json: @source.as_json(include: { nodes: { only: [:id, :label, :node_type] } }) }
    end
  end

  def create
    @source = current_user.sources.build(source_params)

    if @source.save
      render json: @source, status: :created
    else
      render json: { errors: @source.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @source.update(source_params)
      render json: @source
    else
      render json: { errors: @source.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @source.destroy
    head :no_content
  end

  private

  def set_source
    @source = current_user.sources.find(params[:id])
  end

  def source_params
    params.require(:source).permit(
      :title,
      :authors,
      :year,
      :kind,
      :publisher_or_venue,
      :doi_or_url,
      :citation,
      :summary,
      tags: []
    )
  end
end
