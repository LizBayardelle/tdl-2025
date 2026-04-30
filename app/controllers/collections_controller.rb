class CollectionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_collection, only: [:show, :update, :destroy, :add_item, :remove_item]

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
        render json: @collections.map { |c|
          share = c.shares.find { |s| s.recipient_id == current_user.id && s.active }
          c.as_json(methods: [:items_count]).merge(
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
        notes = @collection.notes.includes(:concept, :linked_sources, :concepts, :people, :tags, :collections)

        json_data = @collection.as_json(only: [:id, :name, :description, :user_id]).merge(
          items_count: @collection.items_count,
          is_owner: @collection.user_id == current_user.id,
          owner_email: @collection.user.email,
          sources: @collection.sources.as_json(only: [:id, :title, :year, :kind, :authors]),
          concepts: @collection.concepts.as_json(only: [:id, :label, :concept_type]),
          people: @collection.people.as_json(only: [:id, :full_name, :role]),
          notes: notes.map { |n|
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
              linked_sources: n.linked_sources.map { |s| { id: s.id, title: s.title, year: s.year } }
            )
          }
        )

        # Owner-only: who this is shared with.
        if @collection.user_id == current_user.id
          json_data[:shares] = @collection.shares.where(active: true).includes(:recipient).map do |share|
            { id: share.id, email: share.recipient.email, permission: share.permission }
          end
        else
          # Recipient view: surface their permission level so the UI can hide
          # mutating actions when read-only.
          share = @collection.shares.find_by(recipient_id: current_user.id, active: true)
          json_data[:share_permission] = share&.permission
        end

        render json: json_data
      }
    end
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
    params.require(:collection).permit(:name, :description)
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
