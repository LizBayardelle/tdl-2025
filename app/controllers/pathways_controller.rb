class PathwaysController < ApplicationController
  before_action :authenticate_user!
  before_action :set_pathway, only: [:show, :update, :destroy]

  # GET /pathways
  # GET /pathways.json
  def index
    @pathways = current_user.pathways

    if params[:sort] == 'alphabetical'
      @pathways = @pathways.alphabetical
    else
      @pathways = @pathways.recent
    end

    respond_to do |format|
      format.html
      format.json {
        render json: @pathways.map { |pathway|
          pathway.as_json.merge(
            nodes_count: pathway.node_sequence&.length || 0
          )
        }
      }
    end
  end

  # GET /pathways/:id
  def show
    nodes = @pathway.nodes

    render json: @pathway.as_json.merge(
      nodes: nodes.map { |node|
        node.as_json(only: [:id, :label, :node_type, :level_status, :summary_top])
      }
    )
  end

  # POST /pathways
  def create
    @pathway = current_user.pathways.build(pathway_params)

    if @pathway.save
      render json: @pathway, status: :created
    else
      render json: { errors: @pathway.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /pathways/:id
  def update
    if @pathway.update(pathway_params)
      render json: @pathway
    else
      render json: { errors: @pathway.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /pathways/:id
  def destroy
    @pathway.destroy
    head :no_content
  end

  private

  def set_pathway
    @pathway = current_user.pathways.find(params[:id])
  end

  def pathway_params
    params.require(:pathway).permit(:name, :description, :goal, node_sequence: [])
  end
end
