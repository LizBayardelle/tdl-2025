module Admin
  class DashboardController < BaseController
    NEAR_QUOTA_THRESHOLD = 0.8
    SIGNUPS_CHART_DAYS = 30
    TOP_USERS_LIMIT = 8
    TOP_USERS_WINDOW = 7.days

    def index
      now = Time.current
      week_ago = TOP_USERS_WINDOW.ago
      chart_start = (SIGNUPS_CHART_DAYS - 1).days.ago.beginning_of_day

      @stats = {
        needs_you: needs_you_counts,
        kpis: kpi_counts(week_ago: week_ago),
        signups_chart: signups_per_day(chart_start, now),
        top_users: top_users_last_window(week_ago, limit: TOP_USERS_LIMIT),
        inventory: inventory_totals,
      }

      respond_to do |format|
        format.html
        format.json { render json: @stats }
      end
    end

    private

    def needs_you_counts
      {
        ready_for_review: ConceptGeneration.where(status: :ready_for_review).count,
        failed_generations: ConceptGeneration.where(status: :failed).count,
        users_near_quota: count_users_near_quota,
      }
    end

    def kpi_counts(week_ago:)
      {
        total_users: User.count,
        new_users_this_week: User.where("created_at >= ?", week_ago).count,
        paid_users: User.where.not(plan: 'free').count,
        generations_this_week: ConceptGeneration.where("created_at >= ?", week_ago).count,
        sources_this_week: Source.where("created_at >= ?", week_ago).count,
        notes_this_week: Note.where("created_at >= ?", week_ago).count,
      }
    end

    # Free + storage users at >= 80% of their monthly cap.  The counter auto-
    # resets monthly inside the model, so some staleness is possible — admin
    # can verify when clicking through.
    def count_users_near_quota
      free_threshold    = (User::CONCEPT_GENERATION_LIMITS['free']    * NEAR_QUOTA_THRESHOLD).ceil
      storage_threshold = (User::CONCEPT_GENERATION_LIMITS['storage'] * NEAR_QUOTA_THRESHOLD).ceil

      free_count    = User.where(plan: 'free')   .where('concept_generations_used >= ?', free_threshold).count
      storage_count = User.where(plan: 'storage').where('concept_generations_used >= ?', storage_threshold).count

      free_count + storage_count
    end

    # 30-day daily signup series, with zero-fills.  Returned in chronological
    # order so the chart can render left-to-right.
    def signups_per_day(from, to)
      counts_by_date = User
        .where(created_at: from..to)
        .group(Arel.sql("DATE(created_at)"))
        .count
        .transform_keys { |d| d.is_a?(String) ? Date.parse(d) : d }

      end_date = to.to_date
      (0...SIGNUPS_CHART_DAYS).map do |i|
        date = end_date - (SIGNUPS_CHART_DAYS - 1 - i).days
        { date: date.iso8601, count: counts_by_date[date].to_i }
      end
    end

    # Top users by activity (concepts + sources + notes created since `since`).
    # Aggregated per-table then summed in Ruby so we don't need a UNION.
    def top_users_last_window(since, limit:)
      concepts_by_user = Concept.where("created_at >= ?", since).group(:user_id).count
      sources_by_user  = Source .where("created_at >= ?", since).group(:user_id).count
      notes_by_user    = Note   .where("created_at >= ?", since).group(:user_id).count

      totals = Hash.new { |h, k| h[k] = { concepts: 0, sources: 0, notes: 0 } }
      concepts_by_user.each { |uid, n| totals[uid][:concepts] = n }
      sources_by_user .each { |uid, n| totals[uid][:sources]  = n }
      notes_by_user   .each { |uid, n| totals[uid][:notes]    = n }

      ranked = totals
        .sort_by { |_, t| -(t[:concepts] + t[:sources] + t[:notes]) }
        .first(limit)
      user_ids = ranked.map(&:first)
      users_by_id = User.where(id: user_ids).index_by(&:id)

      ranked.map do |uid, t|
        u = users_by_id[uid]
        next nil unless u
        total = t[:concepts] + t[:sources] + t[:notes]
        {
          id: uid,
          email: u.email,
          plan: u.effective_plan,
          admin: u.admin,
          concepts: t[:concepts],
          sources: t[:sources],
          notes: t[:notes],
          total: total,
        }
      end.compact
    end

    def inventory_totals
      user_count = User.count
      divisor = user_count.zero? ? 1 : user_count.to_f

      {
        concepts:  inventory_row(Concept.count,  divisor),
        sources:   inventory_row(Source.count,   divisor),
        people:    inventory_row(Person.count,   divisor),
        notes:     inventory_row(Note.count,     divisor),
        tabletops: inventory_row(Tabletop.count, divisor),
      }
    end

    def inventory_row(total, divisor)
      {
        total: total,
        avg_per_user: (total / divisor).round(1),
      }
    end
  end
end
