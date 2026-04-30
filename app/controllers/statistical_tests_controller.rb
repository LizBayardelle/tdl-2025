class StatisticalTestsController < ApplicationController
  # Public catalog: a browseable reference of statistical tests. The same
  # JSON index endpoint also feeds the source form modal's select.

  def index
    @tests = StatisticalTest.search(params[:q])

    respond_to do |format|
      format.html
      format.json {
        render json: @tests.map { |t| serialize(t) }
      }
    end
  end

  def show
    @test = StatisticalTest.find_by!(slug: params[:slug])

    respond_to do |format|
      format.html
      format.json { render json: serialize(@test) }
    end
  rescue ActiveRecord::RecordNotFound
    respond_to do |format|
      format.html { redirect_to statistical_tests_path, alert: "We don't have that test in the catalog yet." }
      format.json { render json: { error: 'Not found' }, status: :not_found }
    end
  end

  private

  def serialize(t)
    hash = {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      aliases: Array(t.aliases),
      position: t.position
    }
    StatisticalTest::SINGLE_SELECT_FIELDS.each_key { |f| hash[f] = t.public_send(f) }
    StatisticalTest::MULTI_SELECT_FIELDS.each_key { |f| hash[f] = Array(t.public_send(f)) }
    hash
  end
end
