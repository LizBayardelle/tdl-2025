class CheckoutsController < ApplicationController
  before_action :authenticate_user!

  def create
    pack = Pack.published.find(params[:pack_id])

    # Check if already owned
    if current_user.packs.include?(pack)
      redirect_to pack_path(pack), alert: "You already own this pack."
      return
    end

    # Handle free packs
    if pack.price_cents == 0
      ProvisionPackJob.perform_later(current_user.id, pack.id)
      redirect_to pack_path(pack), notice: "Pack added to your library!"
      return
    end

    # Create Stripe checkout session
    session = Stripe::Checkout::Session.create(
      mode: "payment",
      customer_email: current_user.email,
      line_items: [{
        price: pack.stripe_price_id,
        quantity: 1
      }],
      metadata: {
        user_id: current_user.id,
        pack_id: pack.id
      },
      success_url: pack_url(pack) + "?purchased=true",
      cancel_url: pack_url(pack)
    )

    redirect_to session.url, allow_other_host: true
  end
end
