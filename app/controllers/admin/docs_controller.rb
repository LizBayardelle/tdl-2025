module Admin
  class DocsController < BaseController
    def index
      @slug = params[:slug] || "page-audit"
    end

    def show
      @slug = params[:slug]
      render :index
    end
  end
end
