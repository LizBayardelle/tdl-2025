class PeopleController < ApplicationController
  before_action :authenticate_user!
  before_action :set_person, only: [:show, :update, :destroy]
  before_action :authorize_edit!, only: [:update, :destroy]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Person)
    @people = Person.where(id: accessible_ids).alphabetical

    respond_to do |format|
      format.html
      format.json {
        render json: @people.includes(:concepts, :sources, :notes, :tags, :collections).map { |person|
          is_owner = person.user_id == current_user.id
          person.as_json.merge(
            sources_count: person.sources.count,
            notes_count: person.notes.count,
            concepts: person.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            sources: person.sources.map { |s| { id: s.id, title: s.title, kind: s.kind } },
            collections: person.collections.map { |c| { id: c.id, name: c.name } },
            tags: is_owner ? person.tags.pluck(:name) : [],
            permission: person.permission_for(current_user),
            is_owner: is_owner
          )
        }
      }
    end
  end

  def search
    query = params[:q]
    orcid = params[:orcid]

    if orcid.present?
      # Exact ORCID match - highest confidence
      @people = current_user.people.where(orcid: orcid).limit(10)
      render json: @people.as_json(only: [:id, :full_name, :role, :orcid]).map { |p| p.merge(match_type: 'orcid') }
    elsif query.present?
      # Search by full_name, first_name, last_name, and aka array
      @people = current_user.people.where(
        "full_name ILIKE :q OR first_name ILIKE :q OR last_name ILIKE :q OR EXISTS (SELECT 1 FROM unnest(aka) AS alias WHERE alias ILIKE :q)",
        q: "%#{query}%"
      ).limit(10)
      render json: @people.as_json(only: [:id, :full_name, :role, :orcid])
    else
      render json: []
    end
  end

  # Search ORCID public registry for author suggestions
  def search_orcid
    family_name = params[:family_name]
    given_name = params[:given_name]
    doi = params[:doi]

    if family_name.blank?
      render json: []
      return
    end

    service = OrcidSearchService.new(family_name: family_name, given_name: given_name, doi: doi)
    results = service.search

    render json: results
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @person.as_json(
          include: {
            concepts: { only: [:id, :label, :node_type] },
            sources: { only: [:id, :title, :authors, :year] },
            collections: { only: [:id, :name, :description] }
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
    @person = Person.find(params[:id])
    head :forbidden unless @person.shared_with?(current_user)
  end

  def authorize_edit!
    head :forbidden unless @person.editable_by?(current_user)
  end

  def person_params
    params.require(:person).permit(
      :full_name,
      :first_name,
      :middle_name,
      :last_name,
      :orcid,
      :role,
      :summary,
      :email,
      :url,
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
