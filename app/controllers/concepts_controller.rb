class ConceptsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_concept, only: [:show, :update, :destroy, :generate_definition, :reject_definition, :suggest_relationships]
  before_action :authorize_edit!, only: [:update, :destroy, :generate_definition, :reject_definition]

  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Concept)
    @concepts = Concept.where(id: accessible_ids)
      .includes(:outgoing_connections, :incoming_connections, :sources, :people, :linked_notes, :collections, :domains, :definition)
      .recent

    respond_to do |format|
      format.html
      format.json {
        render json: @concepts.map { |concept|
          concept.as_json(
            methods: [:sources_count, :people_count, :all_people_count, :notes_count, :tags_count, :collections_count, :effective_concept_type],
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
              domains: { only: [:id, :name] },
              definition: { only: [:id, :label] }
            }
          ).merge(
            collections: concept.collections.map { |c| { id: c.id, name: c.name } },
            tags: concept.tags.pluck(:name),
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
        # Sources tagged with this concept, enriched with note count and
        # marker info so the show page can sort key sources first and surface
        # the most-noted papers.
        source_records = @concept.sources.includes(:notes).to_a
        source_ids = source_records.map(&:id)
        sources_payload = source_records.map do |s|
          markers = s.markers || []
          {
            id: s.id, title: s.title, authors: s.authors_string, year: s.year,
            kind: s.kind, doi: s.doi, journal_name: s.journal_name,
            markers: markers,
            notes_count: s.notes.size,
            is_key_source: markers.include?('Key Source')
          }
        end

        # Key authors — researchers behind this concept's literature, ranked
        # by how many sources tagged with this concept they've authored.
        key_authors_payload = []
        if source_ids.any?
          counts = PersonSource.where(source_id: source_ids).group(:person_id).count
          top_pairs = counts.sort_by { |_, c| -c }.first(8)
          top_ids = top_pairs.map(&:first)
          people_by_id = Person.where(id: top_ids).index_by(&:id)
          key_authors_payload = top_pairs.map { |id, count|
            person = people_by_id[id]
            next nil unless person
            {
              id: person.id, full_name: person.full_name, role: person.role,
              orcid: person.orcid, affiliation: person.affiliation,
              source_count: count
            }
          }.compact
        end

        # Notes whose source is tagged with this concept — the user's own
        # knowledge work on the topic.  Capped to a recent window.
        contextual_notes_payload = []
        if source_ids.any?
          contextual_notes_payload = Note
            .where(source_id: source_ids)
            .includes(:source)
            .order(created_at: :desc)
            .limit(20)
            .map { |n|
              {
                id: n.id,
                title: n.title,
                body: n.body,
                note_type: n.note_type,
                noted_on: n.noted_on,
                created_at: n.created_at,
                source: n.source && { id: n.source.id, title: n.source.title }
              }
            }
        end

        render json: @concept.as_json(
          methods: [:sources_count, :people_count, :notes_count, :tags_count, :collections_count, :effective_concept_type],
          include: {
            people: { only: [:id, :full_name, :role, :summary] },
            collections: { only: [:id, :name, :description] },
            domains: { only: [:id, :name] },
            definition: {
              only: [
                :id, :label, :aliases, :concept_type, :summary, :description,
                :location, :examples, :etymology, :school_of_thought, :history,
                :controversy, :clinical_relevance, :misconceptions, :mnemonic,
                :developmental_notes, :measurement_notes, :attribution,
                :external_refs
              ]
            },
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
        ).merge(
          tags: @concept.tags.pluck(:name),
          source_ids: @concept.source_ids,
          person_ids: @concept.person_ids,
          sources: sources_payload,
          key_authors: key_authors_payload,
          generation_quota: current_user.concept_generation_quota,
          contextual_notes: contextual_notes_payload,
        )
      }
    end
  end

  def create
    tags_array = params[:concept][:tags]
    @concept = current_user.concepts.build(concept_params.except(:tags, :people_ids, :source_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type, :domain_ids))

    if @concept.save
      @concept.tag_list = tags_array unless tags_array.nil?
      update_domains(@concept, params[:concept][:domain_ids]) if params[:concept][:domain_ids]
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]
      update_source_associations(@concept, params[:concept][:source_ids]) if params[:concept][:source_ids]
      create_relationship(@concept, params[:concept][:new_relationship_dst_concept_id], params[:concept][:new_relationship_rel_type]) if params[:concept][:new_relationship_dst_concept_id].present?

      render json: @concept.as_json.merge(tags: @concept.tags.pluck(:name)), status: :created
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    tags_array = params[:concept][:tags]
    if @concept.update(concept_params.except(:tags, :people_ids, :source_ids, :new_relationship_dst_concept_id, :new_relationship_rel_type, :domain_ids))
      @concept.tag_list = tags_array unless tags_array.nil?
      update_domains(@concept, params[:concept][:domain_ids]) if params[:concept][:domain_ids]
      update_people_associations(@concept, params[:concept][:people_ids]) if params[:concept][:people_ids]
      update_source_associations(@concept, params[:concept][:source_ids]) if params[:concept][:source_ids]
      create_relationship(@concept, params[:concept][:new_relationship_dst_concept_id], params[:concept][:new_relationship_rel_type]) if params[:concept][:new_relationship_dst_concept_id].present?

      render json: @concept.as_json.merge(tags: @concept.tags.pluck(:name))
    else
      render json: { errors: @concept.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @concept.destroy
    head :no_content
  end

  # POST /concepts/:id/generate_definition
  # Either links an existing shared ConceptDefinition (cache hit, no API
  # call) or enqueues a background job to generate a fresh one.  Cache hits
  # still consume one library-addition slot — pricing is per addition, not
  # per Claude call.  Pass force_fresh=true to skip the cache (used by the
  # post-rejection regen flow when the user was previously served a wrong-
  # sense match — see reject_definition).
  def generate_definition
    if @concept.definition_id.present?
      render json: { error: 'This concept already has a definition.' }, status: :unprocessable_entity
      return
    end

    force_fresh = ActiveModel::Type::Boolean.new.cast(params[:force_fresh])

    cached = unless force_fresh
      ConceptDefinition.best_match_for(
        slug: @concept.label.to_s.parameterize,
        concept_type: @concept.concept_type,
      )
    end

    begin
      current_user.consume_concept_generation!
    rescue User::InsufficientQuota
      limit = current_user.concept_generation_limit
      render json: {
        error: 'over_quota',
        message: "You've used all #{limit} Concept Library Addition#{limit == 1 ? '' : 's'} on the #{current_user.effective_plan.titleize} tier this month.",
        tier: current_user.effective_plan,
        upgrade_url: subscribe_path,
      }, status: :payment_required
      return
    end

    if cached
      @concept.update!(definition_id: cached.id, definition_acquired_via: 'cache_hit')
      ConceptDefinition.increment_counter(:linked_count_cache, cached.id)
      render json: {
        queued: false,
        cache_hit: true,
        definition_id: cached.id,
        unlimited: current_user.concept_generations_unlimited?,
        remaining: current_user.concept_generations_unlimited? ? nil : current_user.concept_generations_remaining,
      }
      return
    end

    GenerateConceptDefinitionJob.perform_later(@concept.id, current_user.id)

    render json: {
      queued: true,
      cache_hit: false,
      unlimited: current_user.concept_generations_unlimited?,
      remaining: current_user.concept_generations_unlimited? ? nil : current_user.concept_generations_remaining,
    }
  end

  # POST /concepts/:id/reject_definition
  # User flagged the linked definition as wrong (e.g., we cache-hit the
  # economic "Depression" but they meant the DSM one).  Increments rejection
  # on the definition (it gets demoted from cache lookups past
  # REJECTION_THRESHOLD), unlinks the concept, and returns free_regen=true
  # if the link came from cache — they shouldn't pay for our bad match.
  def reject_definition
    unless @concept.definition_id.present?
      render json: { error: 'No definition to reject.' }, status: :unprocessable_entity
      return
    end

    was_cache_hit = @concept.definition_acquired_via == 'cache_hit'
    rejected_id   = @concept.definition_id

    ConceptDefinition.increment_counter(:rejection_count, rejected_id)
    ConceptDefinition.where(id: rejected_id).where("linked_count_cache > 0")
      .update_all("linked_count_cache = linked_count_cache - 1")
    @concept.update!(definition_id: nil, definition_acquired_via: nil)

    # Refund quota if the user was served a cache hit — they shouldn't lose
    # a library-addition slot to our bad match.  Fresh-gen rejections still
    # cost the slot (we paid Claude; the result was simply not their cup of
    # tea, and the regen will pay Claude again).
    if was_cache_hit
      User.transaction do
        current_user.lock!
        next_count = [current_user.concept_generations_used.to_i - 1, 0].max
        current_user.update_columns(concept_generations_used: next_count)
      end
    end

    render json: {
      rejected: true,
      free_regen: was_cache_hit,
      unlimited: current_user.concept_generations_unlimited?,
      remaining: current_user.concept_generations_unlimited? ? nil : current_user.concept_generations_remaining,
    }
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

  # POST /concepts/:id/suggest_relationships
  # Calls Claude Haiku to propose connections between this concept and a
  # capped sample of the user's other concepts.
  def suggest_relationships
    concept = current_user.concepts.find_by(slug: params[:id]) || current_user.concepts.find(params[:id])

    # Skip concepts already directly connected so we don't waste tokens.
    connected_ids = Connection
      .where("src_concept_id = :id OR dst_concept_id = :id", id: concept.id)
      .pluck(:src_concept_id, :dst_concept_id)
      .flatten.uniq - [concept.id]

    candidates = current_user.concepts
      .where.not(id: [concept.id, *connected_ids])
      .order(updated_at: :desc)
      .limit(60)

    candidate_payload = candidates.map do |c|
      { id: c.id, label: c.label, concept_type: c.effective_concept_type }
    end

    if candidate_payload.empty?
      render json: { suggestions: [], message: 'No unconnected concepts available to suggest from.' }
      return
    end

    service = RelationshipSuggestionService.new(concept: concept, candidates: candidate_payload)
    raw = service.suggest

    candidates_by_id = candidate_payload.index_by { |c| c[:id] }
    hydrated = raw.map do |s|
      target = candidates_by_id[s.target_id]
      next nil unless target
      {
        target_id:   s.target_id,
        target_label: target[:label],
        target_type:  target[:concept_type],
        rel_type:    s.rel_type,
        reasoning:   s.reasoning,
      }
    end.compact

    render json: { suggestions: hydrated }
  rescue ActiveRecord::RecordNotFound
    head :not_found
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
      source_ids: [],
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

  def update_source_associations(concept, source_ids)
    return unless source_ids.is_a?(Array)
    concept.concept_sources.destroy_all
    source_ids.each do |source_id|
      next if source_id.blank?
      source = current_user.sources.find_by(id: source_id)
      concept.concept_sources.create(source: source) if source
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
