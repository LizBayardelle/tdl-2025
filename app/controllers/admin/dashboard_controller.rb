module Admin
  class DashboardController < BaseController
    def index
      @stats = {
        total_users: User.count,
        users_this_month: User.where("created_at >= ?", Time.current.beginning_of_month).count,
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
