module Admin
  class UsersController < BaseController
    USER_LIST_LIMIT = 200

    def index
      users = User
        .order(created_at: :desc)
        .limit(USER_LIST_LIMIT)
        .includes(:subscriptions)
      user_ids = users.map(&:id)

      concepts_by_user  = Concept .where(user_id: user_ids).group(:user_id).count
      sources_by_user   = Source  .where(user_id: user_ids).group(:user_id).count
      notes_by_user     = Note    .where(user_id: user_ids).group(:user_id).count
      tabletops_by_user = Tabletop.where(user_id: user_ids).group(:user_id).count
      people_by_user    = Person  .where(user_id: user_ids).group(:user_id).count

      serialized = users.map do |u|
        serialize_user(
          u,
          concepts:       concepts_by_user[u.id]  || 0,
          sources:        sources_by_user[u.id]   || 0,
          notes:          notes_by_user[u.id]     || 0,
          tabletops:      tabletops_by_user[u.id] || 0,
          people:         people_by_user[u.id]    || 0,
          monthly_cents:  monthly_payment_cents(u),
          lifetime_cents: lifetime_revenue_cents(u)
        )
      end

      respond_to do |format|
        format.html
        format.json { render json: { users: serialized, summary: summary_payload } }
      end
    end

    def update
      @user = User.find(params[:id])
      if @user.update(user_params)
        render json: { id: @user.id, email: @user.email, admin: @user.admin }
      else
        render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def user_params
      params.require(:user).permit(:admin)
    end

    def summary_payload
      {
        total: User.count,
        admins: User.where(admin: true).count,
        by_plan: {
          free:      User.where(plan: 'free').count,
          storage:   User.where(plan: 'storage').count,
          unlimited: User.where(plan: 'unlimited').count,
        },
        listed: [USER_LIST_LIMIT, User.count].min,
        list_limit: USER_LIST_LIMIT,
      }
    end

    def serialize_user(u, concepts:, sources:, notes:, tabletops:, people:, monthly_cents:, lifetime_cents:)
      effective = u.effective_plan
      limit_raw = User::CONCEPT_GENERATION_LIMITS[effective]
      limit = limit_raw == Float::INFINITY ? nil : limit_raw

      {
        id: u.id,
        email: u.email,
        admin: u.admin,
        plan: u.plan,
        effective_plan: effective,
        plan_through: u.plan_through,
        stripe_customer_id: u.stripe_customer_id,
        created_at: u.created_at,
        concept_generations_used: u.concept_generations_used,
        concept_generation_limit: limit,
        monthly_cents: monthly_cents,
        lifetime_cents: lifetime_cents,
        activity: {
          concepts: concepts,
          sources: sources,
          notes: notes,
          tabletops: tabletops,
          people: people,
        },
      }
    end

    # Monthly equivalent of the user's currently active subscription.  Free
    # users return 0.  Annual subs are divided by 12 and rounded.
    def monthly_payment_cents(user)
      sub = user.subscriptions.find { |s| %w[active past_due].include?(s.status) }
      return 0 unless sub && sub.amount_cents

      case sub.interval
      when 'month' then sub.amount_cents
      when 'year'  then (sub.amount_cents / 12.0).round
      else              0
      end
    end

    # Estimated lifetime revenue.  Sums the billed periods of every
    # subscription the user has ever had: counts each completed period
    # plus the current/final one (since payment is upfront per period).
    # An estimate, not invoice-accurate — Stripe is the source of truth.
    def lifetime_revenue_cents(user)
      user.subscriptions.sum do |sub|
        next 0 unless sub.amount_cents

        end_time = sub.canceled_at || Time.current
        next 0 if end_time <= sub.created_at

        period_seconds = sub.interval == 'year' ? 1.year.to_i : 1.month.to_i
        periods = ((end_time - sub.created_at) / period_seconds).floor + 1
        periods * sub.amount_cents
      end
    end
  end
end
