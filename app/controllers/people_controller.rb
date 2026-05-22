class PeopleController < ApplicationController
  before_action :authenticate_user!
  before_action :set_person, only: [:show, :update, :destroy, :enrich, :sources_index]
  before_action :authorize_edit!, only: [:update, :destroy, :enrich]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Person)
    @people = Person.where(id: accessible_ids).alphabetical

    respond_to do |format|
      format.html
      format.json {
        # "Effective" reach for each facet — direct links plus everything
        # this person is connected to via sources they've authored.  Batched
        # in the model so this stays N+1-free.
        effective_concept_ids_by_person    = Person.effective_concept_ids_for(accessible_ids)
        effective_tag_names_by_person      = Person.effective_tag_names_for(accessible_ids)
        effective_collection_ids_by_person = Person.effective_collection_ids_for(accessible_ids)

        # One label lookup per facet — needed so the sidebar can render names
        # for via-source items that aren't directly linked to any Person.
        all_effective_concept_ids    = effective_concept_ids_by_person.values.flatten.uniq
        all_effective_collection_ids = effective_collection_ids_by_person.values.flatten.uniq

        concept_labels    = Concept.where(id: all_effective_concept_ids).pluck(:id, :label).to_h
        collection_labels = Collection.where(id: all_effective_collection_ids).pluck(:id, :name).to_h

        render json: @people.includes(:concepts, :sources, :notes, :tags, :collections).map { |person|
          is_owner = person.user_id == current_user.id
          eff_concept_ids    = effective_concept_ids_by_person[person.id]    || []
          eff_tag_names      = effective_tag_names_by_person[person.id]      || []
          eff_collection_ids = effective_collection_ids_by_person[person.id] || []

          eff_concepts    = eff_concept_ids.map { |cid|    concept_labels[cid]    && { id: cid, label: concept_labels[cid] } }.compact
          eff_collections = eff_collection_ids.map { |cid| collection_labels[cid] && { id: cid, name:  collection_labels[cid] } }.compact

          person.as_json.merge(
            sources_count: person.sources.count,
            notes_count: person.notes.count,
            concepts: person.concepts.map { |c| { id: c.id, label: c.label, slug: c.slug } },
            effective_concept_ids: eff_concept_ids,
            effective_concepts: eff_concepts,
            sources: person.sources.map { |s| { id: s.id, title: s.title, kind: s.kind } },
            collections: person.collections.map { |c| { id: c.id, name: c.name } },
            effective_collection_ids: eff_collection_ids,
            effective_collections: eff_collections,
            tags: is_owner ? person.tags.pluck(:name) : [],
            effective_tag_names: is_owner ? eff_tag_names : [],
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
            concepts: { only: [:id, :label, :concept_type] },
            sources: { only: [:id, :title, :authors, :year, :doi] },
            collections: { only: [:id, :name, :description] }
          }
        ).merge(
          tags: @person.tags.pluck(:name),
          related_people: @person.related_people(viewer: current_user)
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
      @person.tag_list = tags_array unless tags_array.nil?

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
      @person.tag_list = tags_array unless tags_array.nil?

      render json: @person.as_json.merge(tags: @person.tags.pluck(:name))
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def enrich
    if @person.orcid.present?
      FleshOutPersonJob.perform_later(@person.id)
      render json: { queued: true, step: 'enriching_from_orcid', orcid: @person.orcid }
      return
    end

    has_dois = @person.sources.where.not(doi: [nil, '']).exists?
    if has_dois
      BackfillPersonOrcidJob.perform_later(@person.id)
      render json: { queued: true, step: 'backfilling_orcid' }
      return
    end

    render json: { error: 'No ORCID and no DOI-bearing sources to disambiguate from.' }, status: :unprocessable_entity
  end

  # GET /people/:id/sources
  # Mounts the SourcesIndex React component scoped to this person.
  def sources_index
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
      :affiliation,
      :attrs,
      aka: [],
      concept_ids: [],
      source_ids: [],
      tags: [],
      links: [:label, :url]
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
