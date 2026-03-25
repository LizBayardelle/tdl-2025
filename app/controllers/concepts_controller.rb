class ConceptsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_concept, only: [:show, :update, :destroy]
  before_action :authorize_edit!, only: [:update, :destroy]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Concept)
    @concepts = Concept.where(id: accessible_ids)
      .includes(:outgoing_connections, :incoming_connections, :sources, :people, :linked_notes, :collections, :definition, :domains)
      .recent

    respond_to do |format|
      format.html
      format.json {
        render json: @concepts.map { |concept|
          concept.as_json(
            methods: [:sources_count, :people_count, :notes_count, :tags_count, :collections_count, :effective_concept_type],
            include: {
              outgoing_connections: {
                only: [:id, :rel_type, :relationship_label],
                include: {
                  dst_concept: { only: [:id, :label, :concept_type] }
                }
              },
              incoming_connections: {
                only: [:id, :rel_type, :relationship_label],
                include: {
                  src_concept: { only: [:id, :label, :concept_type] }
                }
              },
              domains: { only: [:id, :name] }
            }
          ).merge(
            collections: concept.collections.map { |c| { id: c.id, name: c.name } },
            permission: concept.permission_for(current_user),
            is_owner: concept.user_id == current_user.id
          )
        }
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @concept.as_json(
          methods: [:sources_count, :people_count, :notes_count, :tags_count, :collections_count, :effective_concept_type],
          include: {
            people: { only: [:id, :full_name, :role, :summary] },
            sources: { only: [:id, :title, :authors, :year, :kind] },
            collections: { only: [:id, :name, :description] },
            domains: { only: [:id, :name] },
            definition: { only: [:id, :label, :concept_type, :summary, :description] },
            outgoing_connections: {
              only: [:id, :rel_type, :relationship_label],
              include: {
                dst_concept: { only: [:id, :label, :concept_type] }
              }
            },
            incoming_connections: {
              only: [:id, :rel_type, :relationship_label],
              include: {
                src_concept: { only: [:id, :label, :concept_type] }
              }
            }
          }
        )
      }
    end
  end

  def create
    @concept = current_user.concepts.build(concept_params.except(:people_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type, :domain_ids))

    if @concept.save
      update_domains(@concept, params[:concept][:domain_ids]) if params[:concept][:domain_ids]
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]
      create_relationship(@concept, params[:concept][:new_relationship_dst_concept_id], params[:concept][:new_relationship_rel_type]) if params[:concept][:new_relationship_dst_concept_id].present?

      render json: @concept, status: :created
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @concept.update(concept_params.except(:people_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type, :domain_ids))
      update_domains(@concept, params[:concept][:domain_ids]) if params[:concept][:domain_ids]
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]
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

  # GET /concepts/search
  def search
    query = params[:q].to_s.strip
    if query.length < 2
      render json: []
      return
    end

    concepts = current_user.concepts
      .where('label ILIKE ? OR label ILIKE ?', "#{query}%", "%#{query}%")
      .limit(10)
      .map { |c| { id: c.id, label: c.label, concept_type: c.effective_concept_type } }

    render json: concepts
  end

  # POST /concepts/find_or_create_from_keywords
  def find_or_create_from_keywords
    keywords = params[:keywords] || []
    concept_ids = []

    keywords.each do |keyword|
      next if keyword.blank?
      keyword = keyword.strip

      concept = current_user.concepts.where('LOWER(label) = LOWER(?)', keyword).first

      unless concept
        concept = current_user.concepts.create(label: keyword.titleize)
      end

      concept_ids << concept.id if concept.persisted?
    end

    render json: { concept_ids: concept_ids }
  end

  # POST /concepts/suggest_from_metadata
  def suggest_from_metadata
    title = params[:title]
    abstract = params[:abstract]
    keywords = params[:keywords] || []

    if title.blank?
      render json: { error: 'Title is required' }, status: :unprocessable_entity
      return
    end

    service = ConceptSuggestionService.new(
      title: title,
      abstract: abstract,
      keywords: keywords
    )

    suggestions = service.suggest

    suggestions_with_matches = suggestions.map do |suggestion|
      label = suggestion['label'] || suggestion[:label]
      matches = find_concept_matches(label)
      suggestion.merge('potential_matches' => matches)
    end

    render json: { suggestions: suggestions_with_matches }
  end

  private

  def set_concept
    @concept = Concept.find_by(slug: params[:id]) || Concept.find(params[:id])
    head :forbidden unless @concept.shared_with?(current_user)
  end

  def authorize_edit!
    head :forbidden unless @concept.editable_by?(current_user)
  end

  def concept_params
    params.require(:concept).permit(
      :concept_type,
      :label,
      :slug,
      :definition_id,
      :summary,
      :description,
      :location,
      :examples,
      :etymology,
      :school_of_thought,
      :history,
      :controversy,
      :clinical_relevance,
      :misconceptions,
      :mnemonic,
      :developmental_notes,
      :measurement_notes,
      :last_reviewed_on,
      :new_relationship_dst_concept_id,
      :new_relationship_rel_type,
      tags: [],
      aliases: [],
      external_refs: [],
      people_ids: [],
      domain_ids: []
    )
  end

  def update_domains(concept, domain_ids)
    return unless domain_ids.is_a?(Array)
    concept.concept_domains.destroy_all
    domain_ids.each do |domain_id|
      next if domain_id.blank?
      domain = Domain.find_by(id: domain_id)
      concept.concept_domains.create(domain: domain) if domain
    end
  end

  def update_people_associations(concept, people_ids)
    return unless people_ids.is_a?(Array)
    concept.people_concepts.destroy_all
    people_ids.each do |person_id|
      next if person_id.blank?
      person = current_user.people.find_by(id: person_id)
      concept.people_concepts.create(person: person) if person
    end
  end

  def create_relationship(concept, dst_concept_id, rel_type)
    return if dst_concept_id.blank?
    dst_concept = current_user.concepts.find_by(id: dst_concept_id)
    return unless dst_concept

    normalized = Connection.normalize_relationship_params(
      concept.id,
      dst_concept_id,
      rel_type || 'related_to'
    )

    current_user.connections.create(normalized)
  end

  def find_concept_matches(label)
    return [] if label.blank?

    exact = current_user.concepts.where('LOWER(label) = LOWER(?)', label).first
    if exact
      return [{ id: exact.id, label: exact.label, concept_type: exact.effective_concept_type, match_type: 'exact' }]
    end

    words = label.split
    partial = current_user.concepts.where(
      'label ILIKE ? OR label ILIKE ?',
      "#{words.first}%",
      "%#{label}%"
    ).limit(5).map do |c|
      { id: c.id, label: c.label, concept_type: c.effective_concept_type, match_type: 'partial' }
    end

    partial
  end
end
