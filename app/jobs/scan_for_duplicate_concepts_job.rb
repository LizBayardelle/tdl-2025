# Bulk-scan a user's existing concept library for likely duplicates.  The
# normal alias-detection pipeline only fires on concept creation, so this is
# the catch-up path for libraries that already had clustery duplicates before
# detection shipped (or for cases the detector missed).
#
# Strategy: pg_trgm finds the top N most-similar pairs (cheap), Haiku judges
# each pair (yes/no it's an alias).  Each "yes" produces one
# concept_alias_suggestion notification.  Pairs are deterministically ordered
# (lower id first) so we never get duplicate notifications for (A,B) vs (B,A).
class ScanForDuplicateConceptsJob < ApplicationJob
  queue_as :default

  PAIR_LIMIT = 50
  TRGM_THRESHOLD = 0.4

  def perform(user_id)
    user = User.find_by(id: user_id)
    return unless user

    pairs = candidate_pairs(user)
    return if pairs.empty?

    pairs.each do |row|
      a = user.concepts.find_by(id: row[:id_a])
      b = user.concepts.find_by(id: row[:id_b])
      next unless a && b

      next if alias_notification_exists?(user, a.id, b.id)

      verdict = ConceptAliasDetectionService.judge_pair(a, b)
      next unless verdict && verdict[:verdict] == 'alias'

      lo, hi = [a, b].sort_by(&:id)
      Notification.create!(
        user_id: user.id,
        kind: Notification::KIND_CONCEPT_ALIAS_SUGGESTION,
        payload: {
          concept_a_id: lo.id,
          concept_a_label: lo.label,
          concept_b_id: hi.id,
          concept_b_label: hi.label,
          confidence: verdict[:confidence],
          reasoning: verdict[:reasoning],
          source: "bulk_scan"
        }
      )
    end
  end

  private

  def candidate_pairs(user)
    # c1.id < c2.id ensures canonical pair ordering and skips (B,A) when (A,B)
    # already considered.  LEFT JOIN against disambiguations excludes pairs the
    # user has already marked as different.
    sql = <<~SQL
      SELECT c1.id AS id_a, c2.id AS id_b, similarity(c1.label, c2.label) AS sim
      FROM concepts c1
      JOIN concepts c2 ON c2.user_id = c1.user_id AND c2.id > c1.id
      LEFT JOIN concept_disambiguations d
        ON d.user_id = c1.user_id
       AND d.concept_a_id = c1.id
       AND d.concept_b_id = c2.id
      WHERE c1.user_id = $1
        AND similarity(c1.label, c2.label) > $2
        AND d.id IS NULL
      ORDER BY sim DESC
      LIMIT $3
    SQL
    binds = [user.id, TRGM_THRESHOLD, PAIR_LIMIT]
    ActiveRecord::Base.connection.exec_query(sql, "scan_duplicate_pairs", binds).to_a.map(&:symbolize_keys)
  end

  # Skip if there's already a pending alias notification for this pair.
  # Checks both the new pair-shape payload and the legacy candidate+suggestions
  # shape so re-running the scan after a partial review doesn't double up.
  def alias_notification_exists?(user, id_a, id_b)
    lo, hi = [id_a, id_b].sort
    Notification
      .where(user_id: user.id, kind: Notification::KIND_CONCEPT_ALIAS_SUGGESTION, status: Notification::STATUS_PENDING)
      .where(
        "((payload->>'concept_a_id')::bigint = :lo AND (payload->>'concept_b_id')::bigint = :hi) " \
        "OR ((payload->>'candidate_concept_id')::bigint = :a AND payload->'suggestions' @> :json_b) " \
        "OR ((payload->>'candidate_concept_id')::bigint = :b AND payload->'suggestions' @> :json_a)",
        lo: lo, hi: hi, a: id_a, b: id_b,
        json_a: [{ id: id_a }].to_json,
        json_b: [{ id: id_b }].to_json
      )
      .exists?
  end
end
