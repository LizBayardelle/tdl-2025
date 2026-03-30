module Admin
  class DashboardController < BaseController
    def index
      @stats = {
        total_users: User.count,
        users_this_month: User.where("created_at >= ?", Time.current.beginning_of_month).count,
        total_packs: Pack.count,
        published_packs: Pack.published.count,
        total_purchases: UserPack.count,
        purchases_this_month: UserPack.where("purchased_at >= ?", Time.current.beginning_of_month).count,
        total_concepts: Concept.count,
        total_sources: Source.count
      }

      respond_to do |format|
        format.html
        format.json { render json: @stats }
      end
    end
  end
end
