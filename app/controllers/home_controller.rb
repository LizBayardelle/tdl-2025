class HomeController < ApplicationController
  def index
  end

  def dashboard
    authenticate_user!
  end

  def sharing
    authenticate_user!
  end
end
