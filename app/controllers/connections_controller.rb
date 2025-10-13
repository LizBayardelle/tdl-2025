class ConnectionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_connection, only: [:show, :update, :destroy]

  # GET /connections
  # GET /connections.json
  def index
    @connections = current_user.connections.includes(:src_concept, :dst_concept)

    # Filter by relationship type
    @connections = @connections.by_type(params[:rel_type]) if params[:rel_type].present?

    # Filter by strength
    @connections = @connections.by_strength(params[:strength]) if params[:strength].present?

    # Filter by concept (either source or destination)
    @connections = @connections.for_concept(params[:concept_id]) if params[:concept_id].present?

    @connections = @connections.recent

    respond_to do |format|
      format.html # render index.html.erb for visualization
      format.json {
        render json: @connections.as_json(include: {
          src_concept: { only: [:id, :label, :node_type] },
          dst_concept: { only: [:id, :label, :node_type] }
        })
      }
    end
  end

  # GET /connections/:id
  def show
    render json: @connection.as_json(include: {
      src_concept: { only: [:id, :label, :node_type, :summary_top] },
      dst_concept: { only: [:id, :label, :node_type, :summary_top] }
    })
  end

  # POST /connections
  def create
    @connection = current_user.connections.build(connection_params)

    if @connection.save
      render json: @connection.as_json(include: {
        src_concept: { only: [:id, :label, :node_type] },
        dst_concept: { only: [:id, :label, :node_type] }
      }), status: :created
    else
      render json: { errors: @connection.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /connections/:id
  def update
    if @connection.update(connection_params)
      render json: @connection.as_json(include: {
        src_concept: { only: [:id, :label, :node_type] },
        dst_concept: { only: [:id, :label, :node_type] }
      })
    else
      render json: { errors: @connection.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /connections/:id
  def destroy
    @connection.destroy
    head :no_content
  end

  private

  def set_connection
    @connection = current_user.connections.find(params[:id])
  end

  def connection_params
    params.require(:connection).permit(
      :src_concept_id,
      :dst_concept_id,
      :rel_type,
      :strength,
      :description,
      :last_reviewed_on,
      tags: []
    )
  end
end
