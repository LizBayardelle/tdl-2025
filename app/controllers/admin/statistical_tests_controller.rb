module Admin
  class StatisticalTestsController < BaseController
    before_action :set_test, only: [:show, :edit, :update, :destroy]

    def index
      @tests = StatisticalTest.search(params[:q])

      respond_to do |format|
        format.html
        format.json { render json: @tests.map { |t| serialize(t) } }
      end
    end

    def new
      @test = StatisticalTest.new
    end

    def create
      test = StatisticalTest.new(test_params)
      if test.save
        render json: serialize(test), status: :created
      else
        render json: { errors: test.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def show
      respond_to do |format|
        format.html { redirect_to edit_admin_statistical_test_path(@test) }
        format.json { render json: serialize(@test) }
      end
    end

    def edit; end

    def update
      if @test.update(test_params)
        render json: serialize(@test)
      else
        render json: { errors: @test.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      @test.destroy
      head :no_content
    end

    # Haiku-powered auto-fill from the test name. Returns a hash of attributes
    # the admin can merge into the form before saving — never persists.
    def auto_fill
      name = params[:name].to_s.strip
      if name.blank?
        render json: { error: 'Name is required' }, status: :unprocessable_entity
        return
      end

      attributes = StatisticalTestAttributesGenerator.new(
        name: name,
        description: params[:description],
        aliases: params[:aliases]
      ).generate

      if attributes.empty?
        render json: { error: "Couldn't auto-fill from that name. Try adding more context." }, status: :bad_gateway
      else
        render json: { attributes: attributes }
      end
    end

    private

    def set_test
      @test = StatisticalTest.find(params[:id])
    end

    def test_params
      params.require(:statistical_test).permit(
        :name, :description, :position,
        *StatisticalTest::SINGLE_SELECT_FIELDS.keys,
        aliases: [],
        goal: [],
        primary_output_desired: []
      )
    end

    def serialize(t)
      hash = {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        aliases: Array(t.aliases),
        position: t.position,
        created_at: t.created_at,
        updated_at: t.updated_at
      }
      StatisticalTest::SINGLE_SELECT_FIELDS.each_key { |f| hash[f] = t.public_send(f) }
      StatisticalTest::MULTI_SELECT_FIELDS.each_key { |f| hash[f] = Array(t.public_send(f)) }
      hash
    end
  end
end
