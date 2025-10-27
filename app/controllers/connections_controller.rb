class ConnectionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_connection, only: [:show, :update, :destroy]

  # GET /connections
  # GET /connections.json
  def index
    @connections = current_user.connections.includes(:src_concept, :dst_concept)

    # Filter by relationship type
    @connections = @connections.by_type(params[:rel_type]) if params[:rel_type].present?

    # Filter by relationship category
    if params[:category].present?
      case params[:category]
      when 'hierarchical'
        @connections = @connections.hierarchical
      when 'semantic'
        @connections = @connections.semantic
      when 'sequential'
        @connections = @connections.sequential
      when 'influence'
        @connections = @connections.influence
      end
    end

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
    # Normalize the relationship to canonical form
    normalized = Connection.normalize_relationship_params(
      connection_params[:src_concept_id],
      connection_params[:dst_concept_id],
      connection_params[:rel_type]
    )

    # Build connection with normalized params
    @connection = current_user.connections.build(
      connection_params.except(:src_concept_id, :dst_concept_id, :rel_type).merge(normalized)
    )

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
    # Normalize the relationship to canonical form
    normalized = Connection.normalize_relationship_params(
      connection_params[:src_concept_id] || @connection.src_concept_id,
      connection_params[:dst_concept_id] || @connection.dst_concept_id,
      connection_params[:rel_type] || @connection.rel_type
    )

    if @connection.update(connection_params.except(:src_concept_id, :dst_concept_id, :rel_type).merge(normalized))
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
      :relationship_label,
      :description,
      :last_reviewed_on,
      tags: []
    )
  end
end
