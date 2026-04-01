class PacksController < ApplicationController
  before_action :authenticate_user!
  before_action :set_pack, only: [:show]

  # GET /packs - browse available packs
  def index
    @packs = Pack.published.includes(:concept_definitions)

    respond_to do |format|
      format.html
      format.json {
        render json: @packs.map { |pack|
          pack.as_json.merge(
            owned: current_user.packs.include?(pack),
            concepts_preview: pack.concept_definitions.limit(5).pluck(:label)
          )
        }
      }
    end
  end

  # GET /packs/:id - show pack details
  def show
    owned = current_user.packs.include?(@pack)

    respond_to do |format|
      format.html
      format.json {
        if owned
          # Full content for owned packs
          definitions = @pack.concept_definitions.includes(:links).map do |defn|
            defn.as_json.merge(links: defn.links.select(:id, :name, :url, :description))
          end
        else
          # Limited preview for unpurchased - NO full content sent
          definitions = @pack.concept_definitions.map do |defn|
            {
              id: defn.id,
              label: defn.label,
              concept_type: defn.concept_type,
              school_of_thought: defn.school_of_thought,
              summary_preview: defn.summary.present? ? defn.summary.truncate(60) : nil
            }
          end
        end

        render json: @pack.as_json.merge(
          owned: owned,
          concept_definitions: definitions
        )
      }
    end
  end

  # GET /packs/owned - redirect to unified packs page
  def owned
    redirect_to packs_path
  end

  private

  def set_pack
    @pack = Pack.find(params[:id])
  end
end
