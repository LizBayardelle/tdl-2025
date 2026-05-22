class Connection < ApplicationRecord
  include Taggable

  belongs_to :user
  belongs_to :src_concept, class_name: "Concept", foreign_key: "src_concept_id"
  belongs_to :dst_concept, class_name: "Concept", foreign_key: "dst_concept_id"

  # =============================================================
  # Vocabulary
  # =============================================================
  #
  # The model stores ONLY canonical kinds (the values in KINDS / the enum
  # below).  User-facing inverses ("child_of" instead of "parent_of") are a
  # UI-input convenience handled by `normalize_relationship_params`, which
  # flips src/dst and rewrites the rel_type before persistence.  Storage is
  # honest about what it contains.
  #
  # Three flavors of canonical kind:
  #
  #   1. Asymmetric with an inverse phrasing (e.g., parent_of ↔ child_of).
  #      We pick one direction as canonical; the other is INPUT-ONLY.
  #   2. Asymmetric without a natural inverse (e.g., influenced, supports).
  #      Stored as written.
  #   3. Symmetric (e.g., related_to).  Stored with src_concept_id <
  #      dst_concept_id so the unique index actually prevents (A,B) +
  #      (B,A) duplicates.
  #
  # The list of input phrasings the UI may submit (canonical + inverses)
  # is INPUT_KINDS.

  HIERARCHICAL_KINDS = %w[parent_of is_a].freeze
  SEMANTIC_KINDS     = %w[related_to contrasts_with integrates_with associated_with].freeze
  SEQUENTIAL_KINDS   = %w[prerequisite_for influenced].freeze # influenced is conceptually sequential
  INFLUENCE_KINDS    = %w[supports critiques].freeze
  CLINICAL_KINDS     = %w[treats prevents causes is_symptom_of operationalizes].freeze
  POSITIONAL_KINDS   = %w[
    is_above contains faces is_near
    superior_to anterior_to medial_to dorsal_to rostral_to proximal_to
    ipsilateral_to contralateral_to
  ].freeze
  OTHER_KINDS        = %w[authored applies_to].freeze

  # The single source of truth — every value here is a canonical rel_type
  # that may appear in the database.  Order matters for the enum mapping.
  KINDS = (HIERARCHICAL_KINDS + SEQUENTIAL_KINDS + SEMANTIC_KINDS +
           INFLUENCE_KINDS + CLINICAL_KINDS + POSITIONAL_KINDS + OTHER_KINDS).freeze

  # Symmetric kinds — direction has no semantic meaning, so storage is
  # normalized to (lower id → higher id) by `normalize_relationship_params`.
  SYMMETRIC_KINDS = %w[
    related_to contrasts_with integrates_with associated_with
    is_near ipsilateral_to contralateral_to
  ].freeze

  # Inverse phrasings the UI may submit.  Maps input → canonical kind.
  # Submitting any key here causes src/dst to be swapped and rel_type
  # to be rewritten to the value before save.  The reverse direction is
  # never persisted directly.
  INPUT_INVERSES = {
    "child_of"               => "parent_of",
    "categorizes"            => "is_a",
    "builds_on"              => "prerequisite_for",
    "derived_from"           => "influenced",
    "is_below"               => "is_above",
    "is_inside"              => "contains",
    "faces_away_from"        => "faces",
    "inferior_to"            => "superior_to",
    "posterior_to"           => "anterior_to",
    "lateral_to"             => "medial_to",
    "ventral_to"             => "dorsal_to",
    "caudal_to"              => "rostral_to",
    "distal_to"              => "proximal_to",
    # Clinical
    "is_treated_by"          => "treats",
    "is_prevented_by"        => "prevents",
    "is_caused_by"           => "causes",
    "has_symptom"            => "is_symptom_of",
    "is_operationalized_by"  => "operationalizes"
  }.freeze

  # All values the UI may submit as `rel_type` — canonical kinds plus their
  # inverse phrasings.  The model itself only stores keys from KINDS.
  INPUT_KINDS = (KINDS + INPUT_INVERSES.keys).freeze

  # ---- Back-compat exports -----------------------------------------
  # Other code (jobs, controllers, JS) refers to these legacy names.
  # They map to the new vocabulary in canonical-only form.
  HIERARCHICAL_TYPES = HIERARCHICAL_KINDS
  SEMANTIC_TYPES     = SEMANTIC_KINDS
  SEQUENTIAL_TYPES   = SEQUENTIAL_KINDS
  INFLUENCE_TYPES    = INFLUENCE_KINDS
  POSITIONAL_TYPES   = POSITIONAL_KINDS
  OTHER_TYPES        = OTHER_KINDS
  CANONICAL_RELATIONSHIPS = KINDS  # Anything in KINDS is canonical by definition.
  INVERSE_PAIRS = INPUT_INVERSES.merge(INPUT_INVERSES.invert).freeze
  # ------------------------------------------------------------------

  # =============================================================
  # Domain scoping — which concept_type combinations a kind makes sense for
  # =============================================================
  #
  # Many kinds are universal (`related_to`, `parent_of`, etc.) and aren't
  # listed here.  Listed kinds are restricted to the indicated concept_types
  # at each end.  Each end is checked independently:
  #
  #   - If KIND_SCOPE[kind][:src] is set, the src concept's type must be in it.
  #   - If KIND_SCOPE[kind][:dst] is set, the dst concept's type must be in it.
  #   - Untyped concepts (concept_type IS NULL) are always allowed at any
  #     end — we don't restrict the picker on concepts the user hasn't yet
  #     classified.
  #
  # The picker shows both directions (canonical + inverse phrasing) so the
  # applicable_input_kinds_for helper checks BOTH orderings of the pair and
  # returns all input phrasings that could legitimately fit.
  ANATOMICAL_TYPES = %w[anatomy physical_entity].freeze

  KIND_SCOPE = {
    # Anatomical positionals — between physical/anatomical entities only
    "superior_to"      => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "anterior_to"      => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "medial_to"        => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "dorsal_to"        => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "rostral_to"       => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "proximal_to"      => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "ipsilateral_to"   => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
    "contralateral_to" => { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },

    # Clinical — interventions act on pathologies/symptoms/emotions
    "treats"           => { src: %w[intervention method research_method], dst: %w[pathology symptom emotion] },
    "prevents"         => { src: %w[intervention method research_method], dst: %w[pathology symptom emotion] },
    "causes"           => { src: %w[pathology phenomenon physical_process non_physical_process], dst: %w[pathology symptom emotion phenomenon] },
    "is_symptom_of"    => { src: %w[symptom emotion phenomenon], dst: %w[pathology] },
    "operationalizes"  => { src: %w[measurement method research_method], dst: %w[phenomenon non_physical_concept theory] }
  }.freeze

  # Enum stores ONLY canonical kinds.  Non-canonical inverses are not valid
  # storage values; they are UI-input shorthand handled by normalize.
  enum :rel_type, KINDS.index_with(&:itself), prefix: true

  # =============================================================
  # Validations
  # =============================================================
  validates :src_concept_id, presence: true
  validates :dst_concept_id, presence: true
  validates :rel_type, presence: true
  validates :user_id, presence: true
  validates :src_concept_id, uniqueness: { scope: [:dst_concept_id, :rel_type], message: "already has this type of relationship with the destination concept" }
  validate :cannot_link_to_self
  validate :symmetric_kinds_must_be_id_ordered

  # =============================================================
  # Scopes
  # =============================================================
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(rel_type: type) }
  scope :from_concept, ->(concept_id) { where(src_concept_id: concept_id) }
  scope :to_concept, ->(concept_id) { where(dst_concept_id: concept_id) }
  scope :for_concept, ->(concept_id) { where("src_concept_id = ? OR dst_concept_id = ?", concept_id, concept_id) }
  scope :hierarchical, -> { where(rel_type: HIERARCHICAL_KINDS) }
  scope :semantic, -> { where(rel_type: SEMANTIC_KINDS) }
  scope :sequential, -> { where(rel_type: SEQUENTIAL_KINDS) }
  scope :influence, -> { where(rel_type: INFLUENCE_KINDS) }
  scope :positional, -> { where(rel_type: POSITIONAL_KINDS) }
  scope :clinical, -> { where(rel_type: CLINICAL_KINDS) }

  # =============================================================
  # Normalization (the one true entry point for translating user input
  # into canonical storage).
  # =============================================================
  #
  # Returns a hash {src_concept_id:, dst_concept_id:, rel_type:} suitable
  # for passing to `Connection.create`/`build`/`update`.  Handles two
  # transformations:
  #
  #   1. If rel_type is an INPUT_INVERSES key (e.g. "child_of"), swap
  #      src/dst and rewrite to canonical (parent_of).
  #   2. If rel_type is symmetric and src_id > dst_id, swap to canonical
  #      ordering.
  def self.normalize_relationship_params(src_concept_id, dst_concept_id, rel_type)
    rel_type = rel_type.to_s

    if INPUT_INVERSES.key?(rel_type)
      canonical = INPUT_INVERSES[rel_type]
      src_concept_id, dst_concept_id = dst_concept_id, src_concept_id
      rel_type = canonical
    end

    if SYMMETRIC_KINDS.include?(rel_type) && src_concept_id && dst_concept_id && src_concept_id.to_i > dst_concept_id.to_i
      src_concept_id, dst_concept_id = dst_concept_id, src_concept_id
    end

    { src_concept_id: src_concept_id, dst_concept_id: dst_concept_id, rel_type: rel_type }
  end

  # Returns the input_kinds (canonical + inverse phrasings) that apply to a
  # concept pair given their concept_types.  Used by the picker UI to hide
  # vocabulary that doesn't make sense for the pair (e.g. anatomical
  # positionals between two theories).  Either type may be nil — untyped
  # concepts are not restricted.
  #
  # The picker offers both directions of each kind, so this method checks
  # both orderings of the pair: if the kind's scope is satisfiable by either
  # (src_type, dst_type) or (dst_type, src_type), the kind is returned.
  def self.applicable_input_kinds_for(src_type:, dst_type:)
    INPUT_KINDS.select do |input_kind|
      canonical = INPUT_INVERSES[input_kind] || input_kind
      scope = KIND_SCOPE[canonical]
      next true if scope.nil?

      pair_fits?(scope, src_type, dst_type) || pair_fits?(scope, dst_type, src_type)
    end
  end

  def self.pair_fits?(scope, src_type, dst_type)
    ok_src = src_type.blank? || scope[:src].nil? || scope[:src].include?(src_type)
    ok_dst = dst_type.blank? || scope[:dst].nil? || scope[:dst].include?(dst_type)
    ok_src && ok_dst
  end

  # Convenience constructor — normalizes input, then creates the connection.
  # Use this in any code path that accepts user-supplied rel_type values
  # (controllers, jobs).  Direct .create with a non-canonical rel_type will
  # fail validation.
  def self.create_normalized!(user:, src_concept_id:, dst_concept_id:, rel_type:, **attrs)
    normalized = normalize_relationship_params(src_concept_id, dst_concept_id, rel_type)
    create!(user: user, **normalized, **attrs)
  end

  # =============================================================
  # Display helpers
  # =============================================================
  def relationship_category
    return :hierarchical if HIERARCHICAL_KINDS.include?(rel_type)
    return :semantic if SEMANTIC_KINDS.include?(rel_type)
    return :sequential if SEQUENTIAL_KINDS.include?(rel_type)
    return :influence if INFLUENCE_KINDS.include?(rel_type)
    return :clinical if CLINICAL_KINDS.include?(rel_type)
    return :positional if POSITIONAL_KINDS.include?(rel_type)
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

  # Symmetric edges must be stored with src_id < dst_id so the unique index
  # on (src, dst, rel_type) prevents storing both (A,B) and (B,A) for the
  # same logical edge.  Run normalize_relationship_params first.
  def symmetric_kinds_must_be_id_ordered
    return unless SYMMETRIC_KINDS.include?(rel_type)
    return if src_concept_id.blank? || dst_concept_id.blank?
    return if src_concept_id < dst_concept_id

    errors.add(:src_concept_id, "must be less than dst_concept_id for symmetric relationships (use Connection.normalize_relationship_params)")
  end
end
