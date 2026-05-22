class NotificationsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_notification, only: [:approve, :dismiss, :mark_read, :mark_different]

  def index
    @notifications = current_user.notifications.recent.limit(100)

    respond_to do |format|
      format.html
      format.json { render json: @notifications.map { |n| serialize(n) } }
    end
  end

  def approve
    case @notification.kind
    when Notification::KIND_CONCEPT_ALIAS_SUGGESTION
      apply_alias_merge
    else
      return render json: { error: "Unknown notification kind" }, status: :unprocessable_entity
    end

    @notification.approve!
    render json: serialize(@notification)
  rescue => e
    Rails.logger.error "Notification approve failed: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def dismiss
    @notification.dismiss!
    render json: serialize(@notification)
  end

  # Records a "these are different things" decision for the pair referenced
  # by this notification, then dismisses the notification.  Disambiguation
  # rows survive across runs of the bulk scan and the autodetect — the user
  # will not be asked about this pair again.
  def mark_different
    case @notification.kind
    when Notification::KIND_CONCEPT_ALIAS_SUGGESTION
      a, b = pair_concepts_from(@notification)
      raise "Both concepts must still exist" unless a && b
      ConceptDisambiguation.record_pair!(current_user, a, b)
    else
      return render json: { error: "Unknown notification kind" }, status: :unprocessable_entity
    end

    @notification.dismiss!
    render json: serialize(@notification)
  rescue => e
    Rails.logger.error "Notification mark_different failed: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def mark_read
    @notification.mark_read!
    render json: serialize(@notification)
  end

  private

  def set_notification
    @notification = current_user.notifications.find(params[:id])
  end

  def serialize(n)
    n.as_json(only: [:id, :kind, :payload, :status, :acted_at, :read_at, :created_at])
  end

  # For an alias-suggestion notification, the user picks which concept should
  # win.  Two payload shapes are supported:
  #
  #   1. Pair shape (current): {concept_a_id, concept_b_id, ...}.  winner_id
  #      must be one of {a,b}; the other is the loser.
  #   2. Legacy shape: {candidate_concept_id, suggestions: [{id, ...}]}.
  #      winner_id picks among suggestions; candidate is always the loser.
  def apply_alias_merge
    payload = @notification.payload || {}
    winner_id = params[:winner_id].presence&.to_i

    if payload["concept_a_id"] || payload[:concept_a_id]
      a_id = (payload["concept_a_id"] || payload[:concept_a_id]).to_i
      b_id = (payload["concept_b_id"] || payload[:concept_b_id]).to_i

      raise "winner_id is required" unless winner_id
      raise "winner_id must be one of the pair" unless [a_id, b_id].include?(winner_id)

      loser_id = winner_id == a_id ? b_id : a_id
      winner = current_user.concepts.find_by(id: winner_id)
      loser  = current_user.concepts.find_by(id: loser_id)
      raise "Winner concept not found" unless winner
      raise "Loser concept not found" unless loser
      ConceptMergeService.call(winner: winner, loser: loser)
    else
      candidate_id = payload["candidate_concept_id"] || payload[:candidate_concept_id]
      suggestions = payload["suggestions"] || payload[:suggestions] || []

      candidate = current_user.concepts.find_by(id: candidate_id)
      raise "Candidate concept no longer exists" unless candidate

      winner_id ||= suggestions.first&.dig("id") || suggestions.first&.dig(:id)
      winner = current_user.concepts.find_by(id: winner_id)
      raise "Winner concept not found" unless winner

      ConceptMergeService.call(winner: winner, loser: candidate)
    end
  end

  def pair_concepts_from(notification)
    payload = notification.payload || {}
    if payload["concept_a_id"] || payload[:concept_a_id]
      a_id = (payload["concept_a_id"] || payload[:concept_a_id]).to_i
      b_id = (payload["concept_b_id"] || payload[:concept_b_id]).to_i
      [current_user.concepts.find_by(id: a_id), current_user.concepts.find_by(id: b_id)]
    else
      candidate_id = (payload["candidate_concept_id"] || payload[:candidate_concept_id]).to_i
      suggestions = payload["suggestions"] || payload[:suggestions] || []
      first = suggestions.first
      other_id = first&.dig("id") || first&.dig(:id)
      [current_user.concepts.find_by(id: candidate_id), current_user.concepts.find_by(id: other_id)]
    end
  end
end
