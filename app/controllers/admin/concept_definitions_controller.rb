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
    # Assigns existing (unassigned) ConceptDefinitions into this pack.
    # Accepts `concept_definition_ids` array or single `concept_definition_id`.
    def import_from_concept
      ids = Array(params[:concept_definition_ids]).presence || Array(params[:concept_definition_id]).compact
      if ids.empty?
        return render json: { errors: ['concept_definition_id or concept_definition_ids required'] }, status: :unprocessable_entity
      end

      definitions = ConceptDefinition.where(id: ids)
      assigned = []
      failed = []

      definitions.each do |cd|
        if cd.pack_id == @pack.id
          failed << { concept_definition_id: cd.id, errors: ['Already in this pack'] }
          next
        end
        if cd.pack_id.present?
          failed << { concept_definition_id: cd.id, errors: ["Already assigned to pack ##{cd.pack_id}"] }
          next
        end
        if cd.update(pack_id: @pack.id)
          assigned << cd
        else
          failed << { concept_definition_id: cd.id, errors: cd.errors.full_messages }
        end
      end

      if assigned.any?
        render json: { created: assigned, failed: failed }, status: :created
      else
        render json: { errors: failed.flat_map { |f| f[:errors] }.presence || ['Nothing assigned'] }, status: :unprocessable_entity
      end
    end

    # GET /admin/packs/:pack_id/concept_definitions/search_concepts
    # Returns unassigned ConceptDefinitions (pack_id: nil) that can be moved
    # into this pack. Filterable by `q` (label) and `concept_types[]`.
    def search_concepts
      query = params[:q].to_s.strip.downcase
      types = Array(params[:concept_types]).reject(&:blank?)

      scope = ConceptDefinition.where(pack_id: nil)
        .select(:id, :label, :concept_type, :summary)

      scope = scope.where("LOWER(label) LIKE ?", "%#{query}%") if query.present?
      scope = scope.where(concept_type: types) if types.any?

      render json: scope.order(Arel.sql('LOWER(label) ASC')).limit(500)
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
