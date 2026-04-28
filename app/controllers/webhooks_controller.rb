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
    when "customer.subscription.created",
         "customer.subscription.updated",
         "customer.subscription.deleted"
      SubscriptionSyncService.sync_stripe_subscription(event.data.object)
    when "invoice.payment_failed"
      handle_invoice_payment_failed(event.data.object)
    when "invoice.payment_succeeded"
      handle_invoice_payment_succeeded(event.data.object)
    end

    head :ok
  end

  private

  # checkout.session.completed fires for both pack purchases and subscription
  # checkouts. Pack purchases carry a pack_id in metadata; subscriptions don't.
  def handle_checkout_completed(session)
    user_id = session.metadata["user_id"]
    pack_id = session.metadata["pack_id"]

    if user_id && pack_id
      ProvisionPackJob.perform_later(user_id.to_i, pack_id.to_i)
      return
    end

    # Subscription checkout: pull the subscription and sync it.
    if session.mode == "subscription" && session.subscription.present?
      stripe_sub = Stripe::Subscription.retrieve(session.subscription)
      SubscriptionSyncService.sync_stripe_subscription(stripe_sub)
    end
  end

  def handle_invoice_payment_failed(invoice)
    return unless invoice.subscription.present?
    SubscriptionSyncService.mark_past_due(invoice.subscription)
  end

  def handle_invoice_payment_succeeded(invoice)
    return unless invoice.subscription.present?
    stripe_sub = Stripe::Subscription.retrieve(invoice.subscription)
    SubscriptionSyncService.sync_stripe_subscription(stripe_sub)
  end
end
