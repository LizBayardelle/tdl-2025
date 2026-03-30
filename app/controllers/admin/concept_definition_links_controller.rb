module Admin
  class ConceptDefinitionLinksController < BaseController
    before_action :set_pack
    before_action :set_concept_definition

    def create
      link = Link.find_or_create_by!(link_params)
      @concept_definition.linkings.find_or_create_by!(link: link)

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
      linking = @concept_definition.linkings.find_by(link_id: params[:id])
      linking&.destroy

      head :no_content
    end

    private

    def set_pack
      @pack = Pack.find(params[:pack_id])
    end

    def set_concept_definition
      @concept_definition = @pack.concept_definitions.find(params[:concept_definition_id])
    end

    def link_params
      params.require(:link).permit(:name, :url, :description)
    end
  end
end
