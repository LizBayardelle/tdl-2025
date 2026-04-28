class HomeController < ApplicationController
  def index
    @homepage_packs = Pack.homepage_featured
                          .includes(:concept_definitions)
                          .order(:created_at)
                          .limit(12)
  end

  def dashboard
    authenticate_user!
  end

  def sharing
    authenticate_user!
  end

  def uploads
    authenticate_user!
  end
end
