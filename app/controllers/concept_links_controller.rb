class ConceptLinksController < ApplicationController
  before_action :authenticate_user!
  before_action :set_concept

  def index
    render json: @concept.links.select(:id, :name, :url, :description)
  end

  def create
    link = Link.find_or_create_by!(link_params)
    @concept.linkings.find_or_create_by!(link: link)

    render json: {
      id: link.id,
      name: link.name,
      url: link.url,
      description: link.description
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def destroy
    linking = @concept.linkings.find_by(link_id: params[:id])
    linking&.destroy

    head :no_content
  end

  private

  def set_concept
    @concept = current_user.concepts.find(params[:concept_id])
  end

  def link_params
    params.require(:link).permit(:name, :url, :description)
  end
end
