# Records a user-confirmed "these two concepts are NOT the same thing"
# decision for a pair of concepts.  Used to suppress repeat alias suggestions
# from the autodetect and bulk-scan flows.  Pair is stored canonically with
# concept_a_id < concept_b_id so a single (A,B) row covers both directions.
class ConceptDisambiguation < ApplicationRecord
  belongs_to :user
  belongs_to :concept_a, class_name: "Concept"
  belongs_to :concept_b, class_name: "Concept"

  validates :concept_a_id, presence: true
  validates :concept_b_id, presence: true
  validate :ordered_pair

  # Records a (concept_x, concept_y) pair as disambiguated for the given user.
  # Idempotent — returns the existing row if already recorded.
  def self.record_pair!(user, x, y)
    a_id, b_id = [x.id, y.id].sort
    raise ArgumentError, "cannot disambiguate a concept with itself" if a_id == b_id

    find_or_create_by!(user_id: user.id, concept_a_id: a_id, concept_b_id: b_id)
  end

  def self.exists_for?(user, x, y)
    return false unless x && y
    a_id, b_id = [x.id, y.id].sort
    where(user_id: user.id, concept_a_id: a_id, concept_b_id: b_id).exists?
  end

  private

  def ordered_pair
    return if concept_a_id.nil? || concept_b_id.nil?
    errors.add(:concept_b_id, "must be greater than concept_a_id") if concept_a_id >= concept_b_id
  end
end
