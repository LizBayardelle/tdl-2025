class CollectionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_collection, only: [:show, :update, :destroy, :add_item, :update_item, :remove_item, :sources_index, :bibliography, :bibliography_export]

  def index
    # Own collections + shared collections
    owned = current_user.collections.includes(:user)
    shared = Collection.joins(:shares)
      .includes(:user, :shares)
      .where(shares: { recipient_id: current_user.id, active: true })

    @collections = (owned + shared).uniq

    respond_to do |format|
      format.html
      format.json {
        # Per-type counts in one query so cards can show a
        # sources/notes/concepts/people breakdown without N+1.
        ids = @collections.map(&:id)
        counts_by_type = CollectionItem.where(collection_id: ids)
          .group(:collection_id, :collectable_type)
          .count

        render json: @collections.map { |c|
          share = c.shares.find { |s| s.recipient_id == current_user.id && s.active }
          counts = {
            sources:  counts_by_type[[c.id, 'Source']]  || 0,
            notes:    counts_by_type[[c.id, 'Note']]    || 0,
            concepts: counts_by_type[[c.id, 'Concept']] || 0,
            people:   counts_by_type[[c.id, 'Person']]  || 0,
          }
          c.as_json(only: [:id, :name, :description, :user_id, :active, :slug]).merge(
            items_count: counts.values.sum,
            counts: counts,
            is_owner: c.user_id == current_user.id,
            owner_email: c.user.email,
            share_permission: share&.permission
          )
        }
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        is_owner = @collection.user_id == current_user.id
        viewer_share = is_owner ? nil : @collection.shares.find_by(recipient_id: current_user.id, active: true)
        include_source_notes = is_owner || viewer_share&.include_source_notes

        direct_notes = @collection.notes.includes(:concept, :linked_sources, :concepts, :people, :tags, :collections)
        direct_note_ids = direct_notes.map(&:id)

        # Source-derived notes: notes attached to a source in this collection
        # but not added to the collection directly. Owner always sees these;
        # recipients see them only when their share opts in.
        source_notes = if include_source_notes
          source_ids = @collection.sources.pluck(:id)
          if source_ids.any?
            Note.where(source_id: source_ids, user_id: @collection.user_id)
              .where.not(id: direct_note_ids)
              .includes(:source, :concept, :linked_sources, :concepts, :people, :tags, :collections)
          else
            []
          end
        else
          []
        end

        serialize_note = ->(n, from_source: false) {
          n.as_json(
            only: [:id, :title, :body, :note_type, :context, :pinned, :noted_on,
                   :source_id, :page_number, :quote_text, :quote_bounds, :created_at],
            include: {
              concept: { only: [:id, :label] },
              concepts: { only: [:id, :label, :concept_type] },
              people: { only: [:id, :full_name, :role] },
              tags: { only: [:id, :name] },
              collections: { only: [:id, :name] }
            }
          ).merge(
            source_ids: n.linked_sources.map(&:id),
            linked_sources: n.linked_sources.map { |s| { id: s.id, title: s.title, year: s.year } },
            from_source: from_source,
            from_source_title: from_source ? n.source&.title : nil,
            from_source_id: from_source ? n.source_id : nil
          )
        }

        source_grouping_ids = @collection.collection_items
          .where(collectable_type: 'Source')
          .pluck(:collectable_id, :grouping_id).to_h

        groupings_payload = @collection.groupings.map do |g|
          { id: g.id, name: g.name, position: g.position }
        end

        json_data = @collection.as_json(only: [:id, :name, :description, :user_id, :active]).merge(
          items_count: @collection.items_count,
          is_owner: is_owner,
          owner_email: @collection.user.email,
          groupings: groupings_payload,
          sources: @collection.sources.as_json(only: [:id, :title, :year, :kind, :authors]).map { |s|
            s.merge('grouping_id' => source_grouping_ids[s['id']])
          },
          concepts: @collection.concepts.as_json(only: [:id, :label, :concept_type]),
          people: @collection.people.as_json(only: [:id, :full_name, :role]),
          notes: direct_notes.map { |n| serialize_note.call(n) } +
                 source_notes.map { |n| serialize_note.call(n, from_source: true) }
        )

        # Owner-only: who this is shared with.
        if is_owner
          json_data[:shares] = @collection.shares.where(active: true).includes(:recipient).map do |share|
            {
              id: share.id,
              email: share.recipient&.email || share.invited_email,
              permission: share.permission,
              include_source_notes: share.include_source_notes
            }
          end
        else
          # Recipient view: surface their permission level so the UI can hide
          # mutating actions when read-only.
          json_data[:share_permission] = viewer_share&.permission
          json_data[:include_source_notes] = !!viewer_share&.include_source_notes
        end

        render json: json_data
      }
    end
  end

  # GET /collections/:id/sources
  # Renders the same SourcesIndex React component, scoped to this collection.
  # Permission gating piggybacks on the existing share infrastructure: viewers
  # see read-only rows, collaborators get full actions.
  def sources_index
    @is_owner = @collection.user_id == current_user.id
    @share_permission = if @is_owner
      'owner'
    else
      @collection.shares.find_by(recipient_id: current_user.id, active: true)&.permission
    end
  end

  # GET /collections/:id/bibliography
  # Annotated-bibliography workspace. Permission gating mirrors sources_index:
  # the React page hides the internal-annotation column for non-owners and
  # disables editing for read-only viewers.
  def bibliography
    @is_owner = @collection.user_id == current_user.id
    @share_permission = if @is_owner
      'owner'
    else
      @collection.shares.find_by(recipient_id: current_user.id, active: true)&.permission
    end
  end

  # GET /collections/:id/bibliography/export
  # Print-ready annotated bibliography, rendered in the chrome-free `print`
  # layout. The React view offers a formatted (UI-mirroring) style and an
  # APA style; the browser handles the actual print / save-as-PDF.
  def bibliography_export
    @is_owner = @collection.user_id == current_user.id
    @share_permission = if @is_owner
      'owner'
    else
      @collection.shares.find_by(recipient_id: current_user.id, active: true)&.permission
    end
    render layout: 'print'
  end

  def create
    @collection = current_user.collections.build(collection_params)
    if @collection.save
      render json: @collection, status: :created
    else
      render json: { errors: @collection.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!
    if @collection.update(collection_params)
      render json: @collection
    else
      render json: { errors: @collection.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def add_item
    authorize_collaborate!

    item = find_item(params[:item_type], params[:item_id])
    @collection.add_item(item,
      include_related: params[:include_related] == 'true',
      added_by: current_user
    )

    render json: { success: true }
  end

  # PATCH /collections/:id/update_item
  # Body: { item_type:, item_id:, grouping_id: }. grouping_id is only
  # meaningful for Source items. Pass nil / empty string to clear back to
  # Unsorted. The model validates that the grouping belongs to this collection.
  def update_item
    authorize_collaborate!

    item = @collection.collection_items
      .find_by(collectable_type: params[:item_type], collectable_id: params[:item_id])
    return head(:not_found) unless item

    if params.key?(:grouping_id)
      raw = params[:grouping_id]
      grouping_id = raw.present? ? raw.to_i : nil
      item.grouping_id = grouping_id
      unless item.save
        return render(json: { errors: item.errors.full_messages }, status: :unprocessable_entity)
      end
    end

    render json: { id: item.id, item_type: item.collectable_type, item_id: item.collectable_id, grouping_id: item.grouping_id }
  end

  def remove_item
    authorize_collaborate!

    @collection.collection_items
      .where(collectable_type: params[:item_type], collectable_id: params[:item_id])
      .destroy_all

    head :no_content
  end

  def destroy
    authorize_owner!
    @collection.destroy
    head :no_content
  end

  private

  def set_collection
    @collection = Collection.find(params[:id])
    head :forbidden unless @collection.shared_with?(current_user)
  end

  def authorize_owner!
    head :forbidden unless @collection.user_id == current_user.id
  end

  def authorize_collaborate!
    head :forbidden unless @collection.collaboratable_by?(current_user)
  end

  def collection_params
    params.require(:collection).permit(:name, :description, :active)
  end

  def find_item(type, id)
    klass = %w[Source Concept Person Note].find { |k| k == type }&.constantize
    raise ActionController::BadRequest, "Invalid type" unless klass

    # Can add own items or items shared with the user
    auth = AuthorizationService.new(current_user)
    item = klass.find(id)

    raise ActionController::BadRequest, "Item not accessible" unless auth.can_view?(item)

    item
  end
end
