class PeopleController < ApplicationController
  before_action :authenticate_user!
  before_action :set_person, only: [:show, :update, :destroy]

  def index
    @people = current_user.people.alphabetical

    respond_to do |format|
      format.html
      format.json {
        render json: @people.includes(:concepts, :sources, :notes, :tags).map { |person|
          person.as_json.merge(
            sources_count: person.sources.count,
            notes_count: person.notes.count,
            concepts: person.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            tags: person.tags.pluck(:name)
          )
        }
      }
    end
  end

  def search
    query = params[:q]
    if query.present?
      @people = current_user.people.where("full_name ILIKE ?", "%#{query}%").limit(10)
      render json: @people.as_json(only: [:id, :full_name, :role])
    else
      render json: []
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
        ).merge(
          tags: @person.tags.pluck(:name)
        )
      }
    end
  end

  def create
    tags_array = params[:person][:tags]
    @person = current_user.people.build(person_params.except(:concept_ids, :source_ids, :tags))

    if @person.save
      # Create associations
      update_concept_associations(@person, params[:person][:concept_ids]) if params[:person][:concept_ids]
      update_source_associations(@person, params[:person][:source_ids]) if params[:person][:source_ids]

      # Use Taggable concern for tags
      @person.tag_list = tags_array if tags_array.present?

      render json: @person.as_json.merge(tags: @person.tags.pluck(:name)), status: :created
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    tags_array = params[:person][:tags]
    if @person.update(person_params.except(:concept_ids, :source_ids, :tags))
      # Update associations
      update_concept_associations(@person, params[:person][:concept_ids]) if params[:person][:concept_ids]
      update_source_associations(@person, params[:person][:source_ids]) if params[:person][:source_ids]

      # Use Taggable concern for tags
      @person.tag_list = tags_array if tags_array.present?

      render json: @person.as_json.merge(tags: @person.tags.pluck(:name))
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @person.destroy
      head :no_content
    else
      # Person has linked sources or notes - can't delete
      error_message = if @person.sources.any?
        "Cannot delete #{@person.full_name} because they are linked to #{@person.sources.count} source(s). Remove them from sources first."
      elsif @person.notes.any?
        "Cannot delete #{@person.full_name} because they are linked to #{@person.notes.count} note(s). Remove them from notes first."
      else
        @person.errors.full_messages.join(', ')
      end

      render json: { error: error_message }, status: :unprocessable_entity
    end
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
      source_ids: [],
      tags: []
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
