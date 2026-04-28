module Admin
  class PacksController < BaseController
    before_action :set_pack, only: [:show, :update, :destroy, :sync_stripe]

    def index
      @packs = Pack.includes(:concept_definitions).order(created_at: :desc)

      respond_to do |format|
        format.html
        format.json {
          render json: @packs.map { |pack|
            pack.as_json.merge(
              concept_definitions_count: pack.concept_definitions.size,
              purchases_count: pack.user_packs.count
            )
          }
        }
      end
    end

    def show
      respond_to do |format|
        format.html
        format.json {
          definitions = @pack.concept_definitions.includes(:links).order(:label).map do |defn|
            defn.as_json.merge(links: defn.links.select(:id, :name, :url, :description))
          end

          render json: @pack.as_json.merge(
            concept_definitions: definitions,
            purchases_count: @pack.user_packs.count
          )
        }
      end
    end

    def create
      @pack = Pack.new(pack_params)

      if @pack.save
        render json: @pack, status: :created
      else
        render json: { errors: @pack.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def update
      if @pack.update(pack_params)
        render json: @pack
      else
        render json: { errors: @pack.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      if @pack.user_packs.exists?
        render json: { errors: ["Cannot delete a pack that has been purchased"] }, status: :unprocessable_entity
      else
        @pack.destroy
        head :no_content
      end
    end

    # POST /admin/packs/:id/sync_stripe
    def sync_stripe
      unless ENV["STRIPE_SECRET_KEY"].present?
        render json: { errors: ["Stripe is not configured"] }, status: :unprocessable_entity
        return
      end

      begin
        # Create or update Stripe product
        if @pack.stripe_product_id.present?
          product = Stripe::Product.update(@pack.stripe_product_id, {
            name: @pack.name,
            description: @pack.description
          })
        else
          product = Stripe::Product.create({
            name: @pack.name,
            description: @pack.description,
            metadata: { pack_id: @pack.id }
          })
          @pack.update!(stripe_product_id: product.id)
        end

        # Create or update Stripe price (prices are immutable, so we create new if price changed)
        if @pack.stripe_price_id.present?
          existing_price = Stripe::Price.retrieve(@pack.stripe_price_id)
          if existing_price.unit_amount != @pack.price_cents
            # Archive old price and create new one
            Stripe::Price.update(@pack.stripe_price_id, { active: false })
            price = Stripe::Price.create({
              product: product.id,
              unit_amount: @pack.price_cents,
              currency: @pack.currency || 'usd',
              metadata: { pack_id: @pack.id }
            })
            @pack.update!(stripe_price_id: price.id)
          end
        else
          price = Stripe::Price.create({
            product: product.id,
            unit_amount: @pack.price_cents,
            currency: @pack.currency || 'usd',
            metadata: { pack_id: @pack.id }
          })
          @pack.update!(stripe_price_id: price.id)
        end

        render json: @pack.reload
      rescue Stripe::StripeError => e
        render json: { errors: [e.message] }, status: :unprocessable_entity
      end
    end

    private

    def set_pack
      @pack = Pack.find(params[:id])
    end

    def pack_params
      params.require(:pack).permit(:name, :description, :price_cents, :currency, :published, :show_on_homepage, :stripe_product_id, :stripe_price_id)
    end
  end
end
