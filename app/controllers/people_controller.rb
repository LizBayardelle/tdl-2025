class PeopleController < ApplicationController
  before_action :authenticate_user!
  before_action :set_person, only: [:show, :update, :destroy]

  def index
    @people = current_user.people.alphabetical

    respond_to do |format|
      format.html
      format.json { render json: @people.includes(:concepts, :sources) }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @person.as_json(
          include: {
            concepts: { only: [:id, :label, :node_type] },
            sources: { only: [:id, :title, :authors, :year] }
          }
        )
      }
    end
  end

  def create
    @person = current_user.people.build(person_params.except(:concept_ids, :source_ids))

    if @person.save
      # Create associations
      update_concept_associations(@person, params[:person][:concept_ids]) if params[:person][:concept_ids]
      update_source_associations(@person, params[:person][:source_ids]) if params[:person][:source_ids]

      render json: @person, status: :created
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @person.update(person_params.except(:concept_ids, :source_ids))
      # Update associations
      update_concept_associations(@person, params[:person][:concept_ids]) if params[:person][:concept_ids]
      update_source_associations(@person, params[:person][:source_ids]) if params[:person][:source_ids]

      render json: @person
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @person.destroy
    head :no_content
  end

  private

  def set_person
    @person = current_user.people.find(params[:id])
  end

  def person_params
    params.require(:person).permit(
      :full_name,
      :role,
      :summary,
      :attrs,
      aka: [],
      concept_ids: [],
      source_ids: []
    )
  end

  def update_concept_associations(person, concept_ids)
    return unless concept_ids.is_a?(Array)

    # Clear existing associations
    person.people_concepts.destroy_all

    # Create new associations
    concept_ids.each do |concept_id|
      next if concept_id.blank?
      concept = current_user.concepts.find_by(id: concept_id)
      person.people_concepts.create(concept: concept) if concept
    end
  end

  def update_source_associations(person, source_ids)
    return unless source_ids.is_a?(Array)

    # Clear existing associations
    person.people_sources.destroy_all

    # Create new associations
    source_ids.each do |source_id|
      next if source_id.blank?
      source = current_user.sources.find_by(id: source_id)
      person.people_sources.create(source: source) if source
    end
  end
end
