class EdgesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_edge, only: [:show, :update, :destroy]

  # GET /edges
  # GET /edges.json
  def index
    @edges = current_user.edges.includes(:src, :dst)

    # Filter by relationship type
    @edges = @edges.by_type(params[:rel_type]) if params[:rel_type].present?

    # Filter by strength
    @edges = @edges.by_strength(params[:strength]) if params[:strength].present?

    # Filter by node (either source or destination)
    @edges = @edges.for_node(params[:node_id]) if params[:node_id].present?

    @edges = @edges.recent

    respond_to do |format|
      format.html # render index.html.erb for visualization
      format.json {
        render json: @edges.as_json(include: {
          src: { only: [:id, :label, :node_type] },
          dst: { only: [:id, :label, :node_type] }
        })
      }
    end
  end

  private

  # GET /edges/:id
  def show
    render json: @edge.as_json(include: {
      src: { only: [:id, :label, :node_type, :summary_top] },
      dst: { only: [:id, :label, :node_type, :summary_top] }
    })
  end

  # POST /edges
  def create
    @edge = current_user.edges.build(edge_params)

    if @edge.save
      render json: @edge.as_json(include: {
        src: { only: [:id, :label, :node_type] },
        dst: { only: [:id, :label, :node_type] }
      }), status: :created
    else
      render json: { errors: @edge.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /edges/:id
  def update
    if @edge.update(edge_params)
      render json: @edge.as_json(include: {
        src: { only: [:id, :label, :node_type] },
        dst: { only: [:id, :label, :node_type] }
      })
    else
      render json: { errors: @edge.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /edges/:id
  def destroy
    @edge.destroy
    head :no_content
  end

  private

  def set_edge
    @edge = current_user.edges.find(params[:id])
  end

  def edge_params
    params.require(:edge).permit(
      :src_id,
      :dst_id,
      :rel_type,
      :strength,
      :description,
      :last_reviewed_on,
      tags: []
    )
  end
end
