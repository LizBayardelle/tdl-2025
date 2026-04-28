class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_one_attached :profile_image

  has_many :concepts, dependent: :destroy
  has_many :connections, dependent: :destroy
  has_many :sources, dependent: :destroy
  has_many :people, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :highlight_colors, dependent: :destroy
  has_many :highlights, dependent: :destroy
  has_many :upload_batches, dependent: :destroy
  has_many :user_packs, dependent: :destroy
  has_many :packs, through: :user_packs
  has_many :subscriptions, dependent: :destroy

  # Collections and shares
  has_many :collections, dependent: :destroy
  has_many :owned_shares, class_name: 'Share', foreign_key: :owner_id, dependent: :destroy
  has_many :received_shares, class_name: 'Share', foreign_key: :recipient_id, dependent: :destroy

  after_create :claim_pending_invitations

  # Three-tier subscription model: Free / Storage / Unlimited.
  PLANS = %w[free storage unlimited].freeze
  FREE_SOURCE_LIMIT = 300
  GRACE_PERIOD = 30.days

  # Per-tier monthly concept-generation budget.  Concept generation is the
  # heavy AI-on-demand action (~$0.30 per call after the Sonnet stage-2 swap)
  # — the full ConceptDefinition write-up with research, fact-check, and
  # link enrichment.  Unlimited uses Float::INFINITY: that's the whole point
  # of the tier.  The natural cap is "your library only has so many concepts"
  # + each concept can only be generated once.
  CONCEPT_GENERATION_LIMITS = {
    'free'      => 5,
    'storage'   => 5,
    'unlimited' => Float::INFINITY,
  }.freeze

  # ---- Plan helpers ------------------------------------------------------

  def free?      = effective_plan == 'free'
  def storage?   = effective_plan == 'storage'
  def unlimited? = effective_plan == 'unlimited'

  # The user's effective plan right now.  Honors plan_through grace and
  # past-due windows: if a paid plan has expired entirely, downgrade.
  def effective_plan
    return plan if plan == 'free'
    return plan if plan_through.nil? || plan_through > Time.current
    'free'
  end

  # Backward-compatible alias used by older code paths.  Pro = "any paying
  # tier" — true if the user is on storage or unlimited with active access.
  def has_pro_access?
    effective_plan != 'free'
  end

  # ---- Source quota (free tier) ------------------------------------------

  # Whether the user can create another source right now.
  # Free users get FREE_SOURCE_LIMIT articles, then a 30-day grace, then blocked.
  def can_create_source?
    return true if has_pro_access?
    return true if sources.count < FREE_SOURCE_LIMIT
    return true if source_count_grace_until && source_count_grace_until > Time.current
    false
  end

  # Lifecycle state of the free-tier source quota.
  #   :pro         → has paid access (limit doesn't apply)
  #   :under_limit → fewer than FREE_SOURCE_LIMIT
  #   :grace       → over the limit, grace window still open
  #   :blocked     → over the limit, grace window expired
  def source_quota_state
    return :pro if has_pro_access?
    return :under_limit if sources.count < FREE_SOURCE_LIMIT
    return :grace if source_count_grace_until && source_count_grace_until > Time.current
    :blocked
  end

  # Stable count for UI rendering (banners, etc.) within a single request.
  def sources_count
    @sources_count ||= sources.count
  end

  # Called when a free user creates a source that pushes them to or past
  # FREE_SOURCE_LIMIT. Sets the grace_until timestamp the first time only.
  def maybe_start_source_grace!
    return if has_pro_access?
    return if source_count_grace_until.present?
    return if sources.count < FREE_SOURCE_LIMIT
    update!(source_count_grace_until: GRACE_PERIOD.from_now)
  end

  # ---- Concept generation quota ------------------------------------------

  # Monthly cap for the user's current tier.
  def concept_generation_limit
    CONCEPT_GENERATION_LIMITS[effective_plan] || 0
  end

  def concept_generations_unlimited?
    concept_generation_limit == Float::INFINITY
  end

  # Counter — auto-resets if we've crossed into a new month since the last
  # reset.  Reads are stable within a request via memoization.
  def concept_generations_remaining
    return Float::INFINITY if concept_generations_unlimited?
    refresh_concept_generation_window!
    [concept_generation_limit - concept_generations_used, 0].max
  end

  def can_generate_concept_definition?
    return true if concept_generations_unlimited?
    concept_generations_remaining > 0
  end

  # Called from the generate-definition endpoint after a successful API call.
  # Atomic increment so two concurrent requests can't both squeak through.
  # Unlimited skips the cap entirely — we still bump the counter for
  # analytics, but never raise.
  def consume_concept_generation!
    refresh_concept_generation_window!
    User.transaction do
      lock!
      unless concept_generations_unlimited?
        raise InsufficientQuota if concept_generations_used >= concept_generation_limit
      end
      update!(concept_generations_used: concept_generations_used + 1)
    end
  end

  class InsufficientQuota < StandardError; end

  # Slides the counter window forward when we cross a calendar month.  We
  # use calendar month rather than billing month for simplicity — the user
  # can rationalize "5 per month" without thinking about subscription dates.
  def refresh_concept_generation_window!
    boundary = Time.current.beginning_of_month
    return if concept_generations_reset_at && concept_generations_reset_at >= boundary
    update_columns(
      concept_generations_used: 0,
      concept_generations_reset_at: boundary,
    )
  end

  # Single source of truth for the quota snapshot exposed to controllers.
  # Forces the monthly refresh BEFORE reading any field so JSON responses
  # never serialize a stale `used` alongside a fresh `remaining`.
  def concept_generation_quota
    refresh_concept_generation_window!
    {
      used:      concept_generations_used,
      limit:     concept_generations_unlimited? ? nil : concept_generation_limit,
      remaining: concept_generations_unlimited? ? nil : [concept_generation_limit - concept_generations_used, 0].max,
      unlimited: concept_generations_unlimited?,
      tier:      effective_plan,
    }
  end

  # ---- Subscription lifecycle -------------------------------------------

  # Recompute plan/plan_through from the user's most-current subscription.
  # Called from webhook handlers after every subscription state change.
  def recompute_plan_from_subscriptions!
    sub = Subscription.current_for(self)
    previous_plan = plan

    if sub.nil?
      update!(plan: "free", plan_through: nil)
    elsif sub.past_due?
      # Past-due grace: keep access for GRACE_PERIOD from now (or keep existing if longer).
      grace_through = GRACE_PERIOD.from_now
      target = [plan_through, grace_through].compact.max
      update!(plan: sub.tier || 'storage', plan_through: target)
    else
      update!(plan: sub.tier || 'storage', plan_through: sub.current_period_end)
      # They're paying — clear any source-count grace.
      update!(source_count_grace_until: nil) if source_count_grace_until.present?
    end

    # If the user dropped from unlimited to a capped tier (storage or free),
    # zero out the concept-generations counter.  Otherwise a heavy unlimited
    # month leaves them stuck at "5 used / 5" on the new tier until the
    # calendar rolls over.
    reset_concept_generation_counter! if downgraded_to_capped?(previous_plan, plan)
  end

  private

  def downgraded_to_capped?(prev, current)
    return false unless prev == 'unlimited'
    %w[free storage].include?(current)
  end

  def reset_concept_generation_counter!
    update_columns(
      concept_generations_used: 0,
      concept_generations_reset_at: Time.current.beginning_of_month,
    )
  end

  def claim_pending_invitations
    Share.pending.where(invited_email: email.downcase).find_each do |share|
      share.update!(recipient_id: id, invite_accepted_at: Time.current)
    end
  end
end
