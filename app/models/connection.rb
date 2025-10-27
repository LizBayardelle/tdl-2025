class Connection < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :src_concept, class_name: "Concept", foreign_key: "src_concept_id"
  belongs_to :dst_concept, class_name: "Concept", foreign_key: "dst_concept_id"

  # Enums for relationship types
  # Core relationship types for visualization
  HIERARCHICAL_TYPES = ['parent_of', 'child_of'].freeze
  SEMANTIC_TYPES = ['related_to', 'contrasts_with', 'integrates_with', 'associated_with'].freeze
  SEQUENTIAL_TYPES = ['prerequisite_for', 'builds_on', 'derived_from'].freeze
  INFLUENCE_TYPES = ['influenced', 'supports', 'critiques'].freeze
  OTHER_TYPES = ['authored', 'applies_to', 'treats'].freeze

  # Define inverse relationship pairs and their canonical direction
  # The canonical direction is the one we always store in the database
  INVERSE_PAIRS = {
    'parent_of' => 'child_of',      # Canonical: parent_of
    'child_of' => 'parent_of',      # Will be converted to parent_of
    'prerequisite_for' => 'builds_on',  # Canonical: prerequisite_for
    'builds_on' => 'prerequisite_for',  # Will be converted to prerequisite_for
    'influenced' => 'derived_from',     # Canonical: influenced
    'derived_from' => 'influenced'      # Will be converted to influenced
  }.freeze

  CANONICAL_RELATIONSHIPS = ['parent_of', 'prerequisite_for', 'influenced'].freeze

  enum :rel_type, {
    # Hierarchical (parent-child)
    parent_of: "parent_of",
    child_of: "child_of",

    # Sequential (learning path)
    prerequisite_for: "prerequisite_for",
    builds_on: "builds_on",
    derived_from: "derived_from",

    # Semantic (bidirectional relations)
    related_to: "related_to",
    contrasts_with: "contrasts_with",
    integrates_with: "integrates_with",
    associated_with: "associated_with",

    # Influence (directional)
    influenced: "influenced",
    supports: "supports",
    critiques: "critiques",

    # Other domain-specific
    authored: "authored",
    applies_to: "applies_to",
    treats: "treats"
  }, prefix: true

  # Validations
  validates :src_concept_id, presence: true
  validates :dst_concept_id, presence: true
  validates :rel_type, presence: true
  validates :user_id, presence: true
  validates :src_concept_id, uniqueness: { scope: :dst_concept_id }
  validate :cannot_link_to_self

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(rel_type: type) }
  scope :from_concept, ->(concept_id) { where(src_concept_id: concept_id) }
  scope :to_concept, ->(concept_id) { where(dst_concept_id: concept_id) }
  scope :for_concept, ->(concept_id) { where("src_concept_id = ? OR dst_concept_id = ?", concept_id, concept_id) }
  scope :hierarchical, -> { where(rel_type: HIERARCHICAL_TYPES) }
  scope :semantic, -> { where(rel_type: SEMANTIC_TYPES) }
  scope :sequential, -> { where(rel_type: SEQUENTIAL_TYPES) }
  scope :influence, -> { where(rel_type: INFLUENCE_TYPES) }

  # Class methods
  def self.normalize_relationship_params(src_concept_id, dst_concept_id, rel_type)
    # Check if this relationship type needs to be inverted to canonical form
    if INVERSE_PAIRS.key?(rel_type) && !CANONICAL_RELATIONSHIPS.include?(rel_type)
      # This is a non-canonical relationship, swap the direction
      canonical_type = INVERSE_PAIRS[rel_type]
      {
        src_concept_id: dst_concept_id,
        dst_concept_id: src_concept_id,
        rel_type: canonical_type
      }
    else
      # Already canonical or not an inverse pair
      {
        src_concept_id: src_concept_id,
        dst_concept_id: dst_concept_id,
        rel_type: rel_type
      }
    end
  end

  # Helper methods
  def relationship_category
    return :hierarchical if HIERARCHICAL_TYPES.include?(rel_type)
    return :semantic if SEMANTIC_TYPES.include?(rel_type)
    return :sequential if SEQUENTIAL_TYPES.include?(rel_type)
    return :influence if INFLUENCE_TYPES.include?(rel_type)
    :other
  end

  def display_label
    relationship_label.presence || rel_type.humanize
  end

  private

  def cannot_link_to_self
    if src_concept_id == dst_concept_id
      errors.add(:dst_concept_id, "cannot link a concept to itself")
    end
  end
end
