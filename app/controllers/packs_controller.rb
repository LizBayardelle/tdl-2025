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
    respond_to do |format|
      format.html
      format.json {
        render json: @pack.as_json.merge(
          owned: current_user.packs.include?(@pack),
          concept_definitions: @pack.concept_definitions.as_json(only: [:id, :label, :concept_type, :summary])
        )
      }
    end
  end

  # GET /packs/owned - user's purchased packs
  def owned
    @packs = current_user.packs.includes(:concept_definitions)

    respond_to do |format|
      format.html
      format.json {
        render json: @packs.map { |pack|
          user_pack = current_user.user_packs.find_by(pack: pack)
          pack.as_json.merge(
            purchased_at: user_pack&.purchased_at,
            concepts_preview: pack.concept_definitions.limit(5).pluck(:label)
          )
        }
      }
    end
  end

  private

  def set_pack
    @pack = Pack.find(params[:id])
  end
end
