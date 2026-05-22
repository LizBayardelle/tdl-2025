class TagsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_tag, only: [:show, :update, :destroy, :sources_index]

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
          by_type = tag.taggings_by_type
          tag.as_json.merge(
            taggings_count: tag.taggings_count,
            taggings_by_type: by_type,
            counts: {
              concepts: by_type['Concept']    || 0,
              sources:  by_type['Source']     || 0,
              people:   by_type['Person']     || 0,
              notes:    by_type['Note']       || 0,
            }
          )
        }
      }
    end
  end

  # GET /tags/:id
  # GET /tags/:id.json
  def show
    respond_to do |format|
      format.html
      format.json {
        # Get all tagged items for this tag
        taggables = {
          concepts: @tag.concepts,
          sources: @tag.sources,
          people: @tag.people,
          connections: @tag.connections.includes(:src, :dst),
          notes: @tag.notes.includes(:concept, :linked_sources, :concepts, :people, :tags, :collections)
        }

        render json: @tag.as_json.merge(
          taggings_count: @tag.taggings_count,
          taggings_by_type: @tag.taggings_by_type,
          concepts: taggables[:concepts].as_json(only: [:id, :label, :concept_type, :summary]),
          sources: taggables[:sources].as_json(only: [:id, :title, :kind, :authors]),
          people: taggables[:people].as_json(only: [:id, :full_name, :role]),
          connections: taggables[:connections].as_json(
            only: [:id, :rel_type, :description],
            include: {
              src: { only: [:id, :label, :concept_type] },
              dst: { only: [:id, :label, :concept_type] }
            }
          ),
          notes: taggables[:notes].map { |n|
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
      }
    end
  end

  # GET /tags/:id/sources
  # Mounts the SourcesIndex React component scoped to this tag.
  def sources_index
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
    params.require(:tag).permit(:name, :description, person_ids: [], concept_ids: [], source_ids: [], note_ids: [])
  end
end
