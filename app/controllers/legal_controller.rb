class LegalController < ApplicationController
  def index
    @slug = nil
  end

  def show
    @slug = params[:slug]
  end
end
