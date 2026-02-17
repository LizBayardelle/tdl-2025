class CollectionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_collection, only: [:show, :update, :destroy, :add_item, :remove_item]

  def index
    # Own collections + shared collections
    owned = current_user.collections
    shared = Collection.joins(:shares)
      .where(shares: { recipient_id: current_user.id, active: true })

    @collections = (owned + shared).uniq

    respond_to do |format|
      format.html
      format.json { render json: @collections.as_json(methods: [:items_count]) }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @collection.as_json(include: {
          sources: { only: [:id, :title] },
          concepts: { only: [:id, :label] },
          people: { only: [:id, :full_name] },
          notes: { only: [:id, :title, :body] }
        })
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
