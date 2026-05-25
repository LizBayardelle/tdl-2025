class CollectionGroupingsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_collection
  before_action :set_grouping, only: [:update, :destroy]

  # GET /collections/:collection_id/groupings
  def index
    render json: serialize_list
  end

  # POST /collections/:collection_id/groupings
  # Body: { name }. Position appended to the end.
  def create
    authorize_edit!

    next_position = (@collection.groupings.maximum(:position) || -1) + 1
    grouping = @collection.groupings.new(name: params[:name].to_s.strip, position: next_position)
    if grouping.save
      render json: serialize_list, status: :created
    else
      render json: { errors: grouping.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /collections/:collection_id/groupings/:id
  # Body: { name?, position? }. Reordering passes a new integer position;
  # other groupings shift to fill the gap.
  def update
    authorize_edit!

    if params.key?(:position)
      reorder_to!(@grouping, params[:position].to_i)
    end

    if params.key?(:name)
      @grouping.name = params[:name].to_s.strip
    end

    if @grouping.save
      render json: serialize_list
    else
      render json: { errors: @grouping.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /collections/:collection_id/groupings/:id
  # The FK is on_delete: nullify, so any sources assigned to this grouping
  # fall back to "Unsorted" automatically.
  def destroy
    authorize_edit!
    @grouping.destroy
    render json: serialize_list
  end

  private

  def set_collection
    @collection = Collection.find(params[:collection_id])
    head :forbidden unless @collection.shared_with?(current_user)
  end

  def set_grouping
    @grouping = @collection.groupings.find(params[:id])
  end

  def authorize_edit!
    head :forbidden unless @collection.collaboratable_by?(current_user)
  end

  # Move `grouping` to the target position, packing the rest of the list
  # tight around it so positions stay contiguous.
  def reorder_to!(grouping, target)
    others = @collection.groupings.where.not(id: grouping.id).to_a
    target = target.clamp(0, others.length)
    reordered = others.first(target) + [grouping] + others.drop(target)
    reordered.each_with_index do |g, idx|
      g.update_column(:position, idx) if g.position != idx
    end
  end

  def serialize_list
    @collection.groupings.reload.map { |g| serialize(g) }
  end

  def serialize(grouping)
    {
      id: grouping.id,
      name: grouping.name,
      position: grouping.position,
      source_count: grouping.collection_items.where(collectable_type: 'Source').count
    }
  end
end
