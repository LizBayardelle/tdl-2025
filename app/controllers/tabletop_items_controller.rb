class TabletopItemsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_tabletop
  before_action :authorize_edit!
  before_action :set_item, only: [:update, :destroy]

  # POST /tabletops/:tabletop_id/items
  def create
    item = @tabletop.tabletop_items.build(item_params)
    item.z_index ||= next_z_index
    if item.save
      render json: serialize(item), status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /tabletops/:tabletop_id/items/:id — drag/resize/edit persistence
  def update
    if @item.update(update_params)
      render json: serialize(@item)
    else
      render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /tabletops/:tabletop_id/items/:id
  def destroy
    @item.destroy
    head :no_content
  end

  private

  def set_tabletop
    @tabletop = Tabletop.find(params[:tabletop_id])
    head :forbidden unless @tabletop.shared_with?(current_user)
  end

  def authorize_edit!
    head :forbidden unless @tabletop.user_id == current_user.id ||
                           %w[owner editor collaborator].include?(@tabletop.permission_for(current_user))
  end

  def set_item
    @item = @tabletop.tabletop_items.find(params[:id])
  end

  def item_params
    params.require(:item).permit(
      :kind, :item_id, :item_type,
      :x, :y, :width, :height, :rotation, :z_index,
      :body, :start_x, :start_y, :end_x, :end_y, :color
    )
  end

  def update_params
    params.require(:item).permit(
      :x, :y, :width, :height, :rotation, :z_index,
      :body, :start_x, :start_y, :end_x, :end_y, :color, :staged
    )
  end

  def next_z_index
    (@tabletop.tabletop_items.maximum(:z_index) || 0) + 1
  end

  def serialize(ti)
    ti.as_json(only: [
      :id, :kind, :item_id, :item_type, :x, :y, :width, :height, :rotation,
      :z_index, :body, :start_x, :start_y, :end_x, :end_y, :color
    ])
  end
end
