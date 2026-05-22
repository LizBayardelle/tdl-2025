# Symmetric relationship types (related_to, contrasts_with, integrates_with,
# associated_with, is_near, ipsilateral_to, contralateral_to) are
# direction-agnostic: (A, sym, B) and (B, sym, A) describe the same edge.
# Going forward we enforce a canonical storage order (src_id < dst_id) so
# the unique index on (src, dst, rel_type) actually prevents duplicates.
#
# This migration brings existing rows into compliance.  Steps:
#   1. Find symmetric rows with src > dst.
#   2. If a counterpart row already exists in canonical order (true duplicate),
#      drop the non-canonical one — keep the older row.
#   3. Otherwise, swap src and dst in place.
class NormalizeSymmetricConnections < ActiveRecord::Migration[7.2]
  SYMMETRIC_KINDS = %w[
    related_to contrasts_with integrates_with associated_with
    is_near ipsilateral_to contralateral_to
  ].freeze

  def up
    Connection.where(rel_type: SYMMETRIC_KINDS).where("src_concept_id > dst_concept_id").find_each do |conn|
      counterpart = Connection.find_by(
        src_concept_id: conn.dst_concept_id,
        dst_concept_id: conn.src_concept_id,
        rel_type: conn.rel_type
      )

      if counterpart && counterpart.id < conn.id
        conn.destroy!
      elsif counterpart && counterpart.id > conn.id
        counterpart.destroy!
        conn.update_columns(src_concept_id: conn.dst_concept_id, dst_concept_id: conn.src_concept_id)
      else
        conn.update_columns(src_concept_id: conn.dst_concept_id, dst_concept_id: conn.src_concept_id)
      end
    end
  end

  def down
    # No-op — direction normalization is data hygiene, not reversible.
  end
end
