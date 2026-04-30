class SubscriptionsController < ApplicationController
  before_action :authenticate_user!, except: [:new]

  TIERS = %w[storage unlimited].freeze

  # GET /subscribe — marketing subscribe page (free vs storage vs unlimited).
  def new
    sync_from_stripe_if_needed if user_signed_in?
    @current_subscription = current_user && Subscription.current_for(current_user)
    @current_tier = current_user&.effective_plan
  end

  # GET /subscription — account / manage page (3-column comparison).
  def show
    sync_from_stripe_if_needed
    @subscription = Subscription.current_for(current_user)
    @current_tier = current_user.effective_plan
    @generation_quota = current_user.concept_generation_quota
  end

  # POST /subscriptions — start a Stripe Checkout subscription session.
  # Params:
  #   tier     → "storage" or "unlimited"
  #   interval → "month" / "monthly" / "year" / "annual"
  def create
    tier     = params[:tier].to_s
    interval = params[:interval].to_s

    unless TIERS.include?(tier)
      redirect_to subscribe_path, alert: "Please choose a plan."
      return
    end
    unless %w[month monthly year annual].include?(interval)
      redirect_to subscribe_path, alert: "Please choose a billing interval."
      return
    end

    price_id = price_id_for(tier, interval)
    if price_id.blank?
      env_var = price_env_var(tier, interval)
      Rails.logger.error("[Subscriptions#create] Missing ENV: #{env_var}")
      redirect_to subscribe_path, alert: "Subscriptions aren't fully configured yet (missing #{env_var}).  Set it in .env (dev) or Heroku config (prod) and try again."
      return
    end

    # Block double-subscribing on the same tier.
    if current_user.effective_plan == tier
      redirect_to subscription_path, notice: "You're already on the #{tier.titleize} plan."
      return
    end

    ensure_stripe_customer!

    # If the user already has an active paid subscription, swap the price
    # in place via Stripe::Subscription.update — this gives them automatic
    # proration and keeps the same subscription ID.  Brand-new payers fall
    # through to Checkout below.
    existing_sub = Subscription.current_for(current_user)
    if existing_sub && existing_sub.status.in?(%w[active past_due])
      switch_subscription!(existing_sub, price_id, tier)
      return
    end

    session = Stripe::Checkout::Session.create(
      mode: "subscription",
      customer: current_user.stripe_customer_id,
      line_items: [{ price: price_id, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { user_id: current_user.id, tier: tier, interval: interval },
      subscription_data: {
        metadata: { user_id: current_user.id, tier: tier }
      },
      success_url: subscription_url + "?subscribed=true",
      cancel_url: subscribe_url
    )

    redirect_to session.url, allow_other_host: true
  rescue Stripe::StripeError => e
    Rails.logger.error("[Subscriptions#create] Stripe error: #{e.message}")
    redirect_to subscribe_path, alert: "Something went wrong starting checkout. Please try again."
  end

  # POST /subscription/cancel — schedules cancel-at-period-end on the user's
  # active subscription.  Doesn't immediately drop them; they keep paid
  # access through the end of their billing period.
  def cancel
    sub = Subscription.current_for(current_user)
    unless sub && sub.external_id.present?
      redirect_to subscription_path, notice: "Nothing to cancel."
      return
    end

    Stripe::Subscription.update(sub.external_id, cancel_at_period_end: true)

    fresh = Stripe::Subscription.retrieve(sub.external_id)
    SubscriptionSyncService.sync_stripe_subscription(fresh)

    end_date = sub.current_period_end&.strftime("%B %-d, %Y")
    notice = end_date ? "Cancellation scheduled — access continues through #{end_date}." : "Cancellation scheduled."
    redirect_to subscription_path, notice: notice
  rescue Stripe::StripeError => e
    Rails.logger.error("[Subscriptions#cancel] #{e.message}")
    redirect_to subscription_path, alert: "Could not cancel: #{e.message}"
  end

  # POST /subscription/resume — undoes a scheduled cancel, restoring
  # auto-renew on a subscription that was set to cancel_at_period_end.
  def resume
    sub = Subscription.current_for(current_user)
    unless sub && sub.external_id.present? && sub.cancel_at_period_end
      redirect_to subscription_path, notice: "Nothing scheduled to resume."
      return
    end

    Stripe::Subscription.update(sub.external_id, cancel_at_period_end: false)

    fresh = Stripe::Subscription.retrieve(sub.external_id)
    SubscriptionSyncService.sync_stripe_subscription(fresh)

    redirect_to subscription_path, notice: "Subscription resumed.  Auto-renew is back on."
  rescue Stripe::StripeError => e
    Rails.logger.error("[Subscriptions#resume] #{e.message}")
    redirect_to subscription_path, alert: "Could not resume: #{e.message}"
  end

  # POST /subscription/portal — open Stripe Customer Portal (cancel/update card/invoices)
  def portal
    unless current_user.stripe_customer_id.present?
      redirect_to subscription_path, alert: "No billing account on file."
      return
    end

    session = Stripe::BillingPortal::Session.create(
      customer: current_user.stripe_customer_id,
      return_url: subscription_url
    )
    redirect_to session.url, allow_other_host: true
  rescue Stripe::StripeError => e
    Rails.logger.error("[Subscriptions#portal] Stripe error: #{e.message}")
    redirect_to subscription_path, alert: "Could not open the billing portal. Please try again."
  end

  private

  # Hard-refreshes the user's subscription from Stripe on every page load.
  # Catches plan switches, cancels, and payment-failed states even when the
  # webhook is delayed or fails.  Throttled to once every 30 seconds so a
  # rapid sequence of refreshes doesn't hammer the Stripe API.
  def sync_from_stripe_if_needed
    return unless current_user.stripe_customer_id.present?

    last = current_user.subscriptions.order(updated_at: :desc).first&.updated_at
    return if last && last > 30.seconds.ago

    stripe_sub = Stripe::Subscription.list(
      customer: current_user.stripe_customer_id,
      limit: 1,
      status: "all"
    ).data.first
    return unless stripe_sub

    SubscriptionSyncService.sync_stripe_subscription(stripe_sub)
  rescue Stripe::StripeError => e
    Rails.logger.warn("[Subscriptions sync] Stripe fetch failed: #{e.message}")
  end

  # Maps (tier, interval) → Stripe price ID.  Storage falls back to the
  # legacy STRIPE_PRICE_*_ID env vars so existing setups keep working.
  def price_id_for(tier, interval)
    ENV[price_env_var(tier, interval)] ||
      legacy_price_for(tier, interval)
  end

  def price_env_var(tier, interval)
    period = (interval == "monthly" || interval == "month") ? "MONTHLY" : "ANNUAL"
    "STRIPE_PRICE_#{tier.upcase}_#{period}_ID"
  end

  # Pre-tier env var names — so existing deployments don't break.
  def legacy_price_for(tier, interval)
    return nil unless tier == "storage"
    case interval
    when "month", "monthly" then ENV["STRIPE_PRICE_MONTHLY_ID"]
    when "year", "annual"   then ENV["STRIPE_PRICE_ANNUAL_ID"]
    end
  end

  # Mid-cycle plan swap.  Updates the existing Stripe subscription's price
  # in place with proration_behavior: 'create_prorations' so the user
  # gets a credit for unused time on the old tier and a charge for the
  # new tier on their next invoice.  No second subscription, no double
  # billing, no lost access.
  def switch_subscription!(local_sub, new_price_id, new_tier)
    stripe_sub = Stripe::Subscription.retrieve(local_sub.external_id)
    item = stripe_sub.items.data.first

    # Switching plans implies the user is staying.  If the existing sub had
    # cancel_at_period_end set (e.g., they'd scheduled a cancel and changed
    # their mind by upgrading), explicitly clear it — Stripe preserves the
    # cancellation flag through price changes by default.
    Stripe::Subscription.update(local_sub.external_id, {
      items: [{ id: item.id, price: new_price_id }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
      metadata: { user_id: current_user.id, tier: new_tier },
    })

    # Refresh local state so the redirect lands on the updated comparison.
    fresh = Stripe::Subscription.retrieve(local_sub.external_id)
    SubscriptionSyncService.sync_stripe_subscription(fresh)

    redirect_to subscription_path,
      notice: "Switched to #{new_tier.titleize}.  Effective immediately, with a prorated adjustment on your next invoice."
  rescue Stripe::StripeError => e
    Rails.logger.error("[Subscriptions#switch] #{e.message}")
    redirect_to subscription_path, alert: "Could not switch plans: #{e.message}"
  end

  def ensure_stripe_customer!
    return if current_user.stripe_customer_id.present?

    customer = Stripe::Customer.create(
      email: current_user.email,
      metadata: { user_id: current_user.id }
    )
    current_user.update!(stripe_customer_id: customer.id)
  end
end
