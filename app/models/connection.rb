class Connection < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :src_concept, class_name: "Concept", foreign_key: "src_concept_id"
  belongs_to :dst_concept, class_name: "Concept", foreign_key: "dst_concept_id"

  # Enums for relationship types
  # Core relationship types for visualization
  HIERARCHICAL_TYPES = ['parent_of', 'child_of', 'is_a'].freeze
  SEMANTIC_TYPES = ['related_to', 'contrasts_with', 'integrates_with', 'associated_with'].freeze
  SEQUENTIAL_TYPES = ['prerequisite_for', 'builds_on', 'derived_from'].freeze
  INFLUENCE_TYPES = ['influenced', 'supports', 'critiques'].freeze
  POSITIONAL_TYPES = [
    'is_above', 'is_below', 'contains', 'is_inside', 'faces', 'faces_away_from', 'is_near',
    'superior_to', 'inferior_to', 'anterior_to', 'posterior_to',
    'medial_to', 'lateral_to', 'dorsal_to', 'ventral_to',
    'rostral_to', 'caudal_to', 'proximal_to', 'distal_to',
    'ipsilateral_to', 'contralateral_to'
  ].freeze
  OTHER_TYPES = ['authored', 'applies_to', 'treats'].freeze

  # Define inverse relationship pairs and their canonical direction
  # The canonical direction is the one we always store in the database
  INVERSE_PAIRS = {
    'parent_of' => 'child_of',      # Canonical: parent_of
    'child_of' => 'parent_of',      # Will be converted to parent_of
    'prerequisite_for' => 'builds_on',  # Canonical: prerequisite_for
    'builds_on' => 'prerequisite_for',  # Will be converted to prerequisite_for
    'influenced' => 'derived_from',     # Canonical: influenced
    'derived_from' => 'influenced',     # Will be converted to influenced
    'is_above' => 'is_below',           # Canonical: is_above
    'is_below' => 'is_above',           # Will be converted to is_above
    'contains' => 'is_inside',          # Canonical: contains
    'is_inside' => 'contains',          # Will be converted to contains
    'faces' => 'faces_away_from',       # Canonical: faces
    'faces_away_from' => 'faces',       # Will be converted to faces
    'superior_to' => 'inferior_to',     # Canonical: superior_to
    'inferior_to' => 'superior_to',     # Will be converted to superior_to
    'anterior_to' => 'posterior_to',    # Canonical: anterior_to
    'posterior_to' => 'anterior_to',    # Will be converted to anterior_to
    'medial_to' => 'lateral_to',        # Canonical: medial_to
    'lateral_to' => 'medial_to',        # Will be converted to medial_to
    'dorsal_to' => 'ventral_to',        # Canonical: dorsal_to
    'ventral_to' => 'dorsal_to',        # Will be converted to dorsal_to
    'rostral_to' => 'caudal_to',        # Canonical: rostral_to
    'caudal_to' => 'rostral_to',        # Will be converted to rostral_to
    'proximal_to' => 'distal_to',       # Canonical: proximal_to
    'distal_to' => 'proximal_to'        # Will be converted to proximal_to
  }.freeze

  CANONICAL_RELATIONSHIPS = [
    'parent_of', 'prerequisite_for', 'influenced',
    'is_above', 'contains', 'faces',
    'superior_to', 'anterior_to', 'medial_to', 'dorsal_to',
    'rostral_to', 'proximal_to'
  ].freeze

  enum :rel_type, {
    # Hierarchical (parent-child)
    parent_of: "parent_of",
    child_of: "child_of",
    is_a: "is_a",

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

    # Positional (general)
    is_above: "is_above",
    is_below: "is_below",
    contains: "contains",
    is_inside: "is_inside",
    faces: "faces",
    faces_away_from: "faces_away_from",
    is_near: "is_near",

    # Positional (anatomical)
    superior_to: "superior_to",
    inferior_to: "inferior_to",
    anterior_to: "anterior_to",
    posterior_to: "posterior_to",
    medial_to: "medial_to",
    lateral_to: "lateral_to",
    dorsal_to: "dorsal_to",
    ventral_to: "ventral_to",
    rostral_to: "rostral_to",
    caudal_to: "caudal_to",
    proximal_to: "proximal_to",
    distal_to: "distal_to",
    ipsilateral_to: "ipsilateral_to",
    contralateral_to: "contralateral_to",

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
  scope :positional, -> { where(rel_type: POSITIONAL_TYPES) }

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
    return :positional if POSITIONAL_TYPES.include?(rel_type)
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
