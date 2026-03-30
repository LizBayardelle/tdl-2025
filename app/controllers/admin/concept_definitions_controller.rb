module Admin
  class ConceptDefinitionsController < BaseController
    before_action :set_pack
    before_action :set_concept_definition, only: [:update, :destroy]

    def create
      @definition = @pack.concept_definitions.build(definition_params)

      if @definition.save
        render json: @definition, status: :created
      else
        render json: { errors: @definition.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # POST /admin/packs/:pack_id/concept_definitions/import_from_concept
    def import_from_concept
      concept = current_user.concepts.find(params[:concept_id])

      @definition = @pack.concept_definitions.build(
        label: concept.label,
        concept_type: concept.concept_type,
        summary: concept.summary,
        description: concept.description,
        location: concept.location,
        examples: concept.examples,
        etymology: concept.etymology,
        school_of_thought: concept.school_of_thought,
        history: concept.history,
        controversy: concept.controversy,
        clinical_relevance: concept.clinical_relevance,
        misconceptions: concept.misconceptions,
        mnemonic: concept.mnemonic,
        developmental_notes: concept.developmental_notes,
        measurement_notes: concept.measurement_notes,
        aliases: concept.aliases
      )

      if @definition.save
        render json: @definition, status: :created
      else
        render json: { errors: @definition.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # GET /admin/packs/:pack_id/concept_definitions/search_concepts
    def search_concepts
      query = params[:q].to_s.downcase
      existing_labels = @pack.concept_definitions.pluck(:label).map(&:downcase)

      concepts = current_user.concepts
        .where("LOWER(label) LIKE ?", "%#{query}%")
        .where.not("LOWER(label) IN (?)", existing_labels.presence || [''])
        .limit(20)
        .select(:id, :label, :concept_type, :summary)

      render json: concepts
    end

    def update
      if @definition.update(definition_params)
        render json: @definition
      else
        render json: { errors: @definition.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      @definition.destroy
      head :no_content
    end

    private

    def set_pack
      @pack = Pack.find(params[:pack_id])
    end

    def set_concept_definition
      @definition = @pack.concept_definitions.find(params[:id])
    end

    def definition_params
      params.require(:concept_definition).permit(
        :label, :concept_type, :summary, :description, :location,
        :examples, :etymology, :school_of_thought, :history,
        :controversy, :clinical_relevance, :misconceptions,
        :mnemonic, :developmental_notes, :measurement_notes,
        :attribution,
        aliases: []
      )
    end
  end
end
