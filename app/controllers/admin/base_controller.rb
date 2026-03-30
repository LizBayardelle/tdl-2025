module Admin
  class BaseController < ApplicationController
    before_action :authenticate_user!
    before_action :require_admin!

    private

    def require_admin!
      unless current_user&.admin?
        flash[:alert] = "You don't have access to that page."
        redirect_to root_path
      end
    end
  end
end
