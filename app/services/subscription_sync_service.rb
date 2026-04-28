# Translates Stripe subscription objects (and related events) into our local
# Subscription rows, then triggers the user's plan recompute.
#
# Provider-agnostic on purpose: when Apple IAP support arrives, the equivalent
# AppleSubscriptionSyncService writes to the same `subscriptions` table with
# `provider: "apple"`, and `User#recompute_plan_from_subscriptions!` keeps
# working without changes.
class SubscriptionSyncService
  STRIPE_TO_LOCAL_STATUS = {
    "active"             => "active",
    "trialing"           => "active",
    "past_due"           => "past_due",
    "unpaid"             => "past_due",
    "incomplete"         => "past_due",
    "incomplete_expired" => "expired",
    "canceled"           => "canceled",
    "paused"             => "past_due"
  }.freeze

  # Sync a Stripe::Subscription object to our local table.
  # Returns the local Subscription record, or nil if user can't be resolved.
  def self.sync_stripe_subscription(stripe_sub)
    user = resolve_user(stripe_sub)
    return nil unless user

    local_status = STRIPE_TO_LOCAL_STATUS[stripe_sub.status] || "expired"
    item         = stripe_sub.items&.data&.first
    price        = item&.price
    interval     = price&.recurring&.interval || "month"
    amount_cents = price&.unit_amount
    tier         = tier_from_price(price&.id) || stripe_sub.metadata&.[]("tier") || "storage"

    # Stripe moved period dates from the subscription object onto the
    # subscription_item in recent API versions.  Try the new location first,
    # fall back to the legacy top-level field for older API responses.
    period_end_ts = item&.current_period_end || stripe_sub.try(:current_period_end)

    sub = Subscription.find_or_initialize_by(
      provider: "stripe",
      external_id: stripe_sub.id
    )
    sub.assign_attributes(
      user: user,
      external_customer_id: stripe_sub.customer,
      status: local_status,
      interval: interval,
      amount_cents: amount_cents,
      currency: price&.currency || "usd",
      tier: tier,
      current_period_end: period_end_ts ? Time.at(period_end_ts) : nil,
      cancel_at_period_end: !!stripe_sub.cancel_at_period_end,
      canceled_at: stripe_sub.canceled_at ? Time.at(stripe_sub.canceled_at) : nil
    )
    sub.save!

    user.recompute_plan_from_subscriptions!
    sub
  end

  # Map a Stripe price ID → tier name based on the configured env vars.
  # Returns nil if the price doesn't match any configured tier; the caller
  # falls back to the metadata tier or the safe "storage" default.
  def self.tier_from_price(price_id)
    return nil if price_id.blank?
    {
      ENV["STRIPE_PRICE_STORAGE_MONTHLY_ID"]   => "storage",
      ENV["STRIPE_PRICE_STORAGE_ANNUAL_ID"]    => "storage",
      ENV["STRIPE_PRICE_UNLIMITED_MONTHLY_ID"] => "unlimited",
      ENV["STRIPE_PRICE_UNLIMITED_ANNUAL_ID"]  => "unlimited",
      # Legacy single-tier env vars — treat as storage.
      ENV["STRIPE_PRICE_MONTHLY_ID"]           => "storage",
      ENV["STRIPE_PRICE_ANNUAL_ID"]            => "storage",
    }.compact[price_id]
  end

  # Mark a stripe subscription as past_due (called on invoice.payment_failed).
  def self.mark_past_due(stripe_subscription_id)
    sub = Subscription.find_by(provider: "stripe", external_id: stripe_subscription_id)
    return unless sub
    sub.update!(status: "past_due")
    sub.user.recompute_plan_from_subscriptions!
    sub
  end

  def self.resolve_user(stripe_sub)
    # 1. Try the metadata user_id (set during checkout).
    user_id = stripe_sub.metadata&.[]("user_id")
    return User.find_by(id: user_id) if user_id

    # 2. Fall back to looking up by stripe_customer_id.
    User.find_by(stripe_customer_id: stripe_sub.customer)
  end
end
