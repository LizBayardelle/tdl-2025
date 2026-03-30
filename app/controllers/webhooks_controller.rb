class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:stripe]

  def stripe
    payload = request.body.read
    sig_header = request.env["HTTP_STRIPE_SIGNATURE"]

    begin
      event = Stripe::Webhook.construct_event(
        payload, sig_header, ENV["STRIPE_WEBHOOK_SECRET"]
      )
    rescue JSON::ParserError
      render json: { error: "Invalid payload" }, status: :bad_request
      return
    rescue Stripe::SignatureVerificationError
      render json: { error: "Invalid signature" }, status: :bad_request
      return
    end

    case event.type
    when "checkout.session.completed"
      handle_checkout_completed(event.data.object)
    end

    head :ok
  end

  private

  def handle_checkout_completed(session)
    user_id = session.metadata["user_id"]
    pack_id = session.metadata["pack_id"]

    return unless user_id && pack_id

    ProvisionPackJob.perform_later(user_id.to_i, pack_id.to_i)
  end
end
