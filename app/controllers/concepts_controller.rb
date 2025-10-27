class ConceptsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_concept, only: [:show, :update, :destroy]

  def index
    @concepts = current_user.concepts.includes(:outgoing_connections, :incoming_connections).recent

    respond_to do |format|
      format.html
      format.json {
        render json: @concepts.as_json(
          include: {
            outgoing_connections: {
              only: [:id, :rel_type, :relationship_label],
              include: {
                dst_concept: { only: [:id, :label, :node_type] }
              }
            },
            incoming_connections: {
              only: [:id, :rel_type, :relationship_label],
              include: {
                src_concept: { only: [:id, :label, :node_type] }
              }
            }
          }
        )
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @concept.as_json(
          include: {
            people: { only: [:id, :full_name, :role, :summary] },
            sources: { only: [:id, :title, :authors, :year, :kind] }
          }
        )
      }
    end
  end

  def create
    @concept = current_user.concepts.build(concept_params.except(:people_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type))

    if @concept.save
      # Create associations
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]

      # Create relationship if specified
      create_relationship(@concept, params[:concept][:new_relationship_dst_concept_id], params[:concept][:new_relationship_rel_type]) if params[:concept][:new_relationship_dst_concept_id].present?

      render json: @concept, status: :created
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @concept.update(concept_params.except(:people_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type))
      # Update associations
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]

      # Create relationship if specified
      create_relationship(@concept, params[:concept][:new_relationship_dst_concept_id], params[:concept][:new_relationship_rel_type]) if params[:concept][:new_relationship_dst_concept_id].present?

      render json: @concept
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @concept.destroy
    head :no_content
  end

  private

  def set_concept
    @concept = current_user.concepts.find(params[:id])
  end

  def concept_params
    params.require(:concept).permit(
      :node_type,
      :label,
      :slug,
      :summary_top,
      :summary_mid,
      :summary_deep,
      :evidence_brief,
      :confidence_note,
      :level_status,
      :last_reviewed_on,
      :new_relationship_dst_concept_id,
      :new_relationship_rel_type,
      mechanisms: [],
      signature_techniques: [],
      strengths: [],
      weaknesses: [],
      adjacent_models: [],
      contrasts_with: [],
      integrates_with: [],
      intake_questions: [],
      micro_skills: [],
      practice_prompts: [],
      assessment_links: [],
      tags: [],
      people_ids: []
    )
  end

  def update_people_associations(concept, people_ids)
    return unless people_ids.is_a?(Array)

    # Clear existing associations
    concept.people_concepts.destroy_all

    # Create new associations
    people_ids.each do |person_id|
      next if person_id.blank?
      person = current_user.people.find_by(id: person_id)
      concept.people_concepts.create(person: person) if person
    end
  end

  def create_relationship(concept, dst_concept_id, rel_type)
    return if dst_concept_id.blank?

    # Find the destination concept
    dst_concept = current_user.concepts.find_by(id: dst_concept_id)
    return unless dst_concept

    # Normalize the relationship to canonical form
    normalized = Connection.normalize_relationship_params(
      concept.id,
      dst_concept_id,
      rel_type || 'related_to'
    )

    # Create the connection with normalized params
    current_user.connections.create(normalized)
  end
end
