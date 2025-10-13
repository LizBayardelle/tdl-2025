class TagsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_tag, only: [:show, :update, :destroy]

  # GET /tags
  # GET /tags.json
  def index
    @tags = current_user.tags

    # Sort by popularity by default, or alphabetically
    if params[:sort] == 'alphabetical'
      @tags = @tags.alphabetical
    else
      @tags = @tags.by_popularity
    end

    respond_to do |format|
      format.html
      format.json {
        render json: @tags.map { |tag|
          tag.as_json.merge(
            taggings_count: tag.taggings_count,
            taggings_by_type: tag.taggings_by_type
          )
        }
      }
    end
  end

  # GET /tags/:id
  def show
    # Get all tagged items for this tag
    taggables = {
      nodes: @tag.nodes,
      sources: @tag.sources,
      people: @tag.people,
      edges: @tag.edges.includes(:src, :dst),
      notes: @tag.notes.includes(:node)
    }

    render json: @tag.as_json.merge(
      taggings_count: @tag.taggings_count,
      taggings_by_type: @tag.taggings_by_type,
      nodes: taggables[:nodes].as_json(only: [:id, :label, :node_type, :summary_top]),
      sources: taggables[:sources].as_json(only: [:id, :title, :kind, :authors]),
      people: taggables[:people].as_json(only: [:id, :full_name, :role]),
      edges: taggables[:edges].as_json(
        only: [:id, :rel_type, :description],
        include: {
          src: { only: [:id, :label, :node_type] },
          dst: { only: [:id, :label, :node_type] }
        }
      ),
      notes: taggables[:notes].as_json(
        only: [:id, :body, :note_type, :created_at],
        include: { node: { only: [:id, :label] } }
      )
    )
  end

  # POST /tags
  def create
    @tag = current_user.tags.build(tag_params)

    if @tag.save
      render json: @tag, status: :created
    else
      render json: { errors: @tag.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /tags/:id
  def update
    if @tag.update(tag_params)
      render json: @tag
    else
      render json: { errors: @tag.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /tags/:id
  def destroy
    @tag.destroy
    head :no_content
  end

  private

  def set_tag
    @tag = current_user.tags.find(params[:id])
  end

  def tag_params
    params.require(:tag).permit(:name, :description, :color)
  end
end
