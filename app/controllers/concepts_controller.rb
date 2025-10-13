class ConceptsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_concept, only: [:show, :update, :destroy]

  def index
    @concepts = current_user.concepts.recent

    respond_to do |format|
      format.html
      format.json { render json: @concepts }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json { render json: @concept }
    end
  end

  def create
    @concept = current_user.concepts.build(concept_params.except(:people_ids))

    if @concept.save
      # Create associations
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]

      render json: @concept, status: :created
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @concept.update(concept_params.except(:people_ids))
      # Update associations
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]

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
end
