class StatisticalTest < ApplicationRecord
  has_many :source_statistical_tests, dependent: :destroy
  has_many :sources, through: :source_statistical_tests

  # ---------------------------------------------------------------------------
  # Controlled vocabularies. Keep in sync with the JS catalog at
  # app/javascript/components/admin/AdminStatisticalTestForm.js.
  # ---------------------------------------------------------------------------

  GOALS = [
    'Compare Groups', 'Test Association', 'Predict Outcome', 'Model Change Over Time',
    'Test Mediation', 'Test Moderation', 'Analyze Survival / Time-to-Event',
    'Reduce Dimensions', 'Identify Latent Structure', 'Classify Cases',
    'Assess Agreement', 'Test Frequencies Against Expected Values'
  ].freeze

  VARIABLE_RELATIONSHIP_STRUCTURES = ['DV–IV Directional', 'Symmetric / Correlation', 'Not Applicable'].freeze
  PRIMARY_VARIABLE_1_TYPES = ['Continuous', 'Ordinal', 'Binary', 'Nominal Categorical', 'Count', 'Time-to-Event', 'None / Not Applicable'].freeze
  PRIMARY_VARIABLE_2_TYPES = ['Continuous', 'Ordinal', 'Binary', 'Nominal Categorical', 'Mixed', 'None / Not Applicable'].freeze
  NUMBER_OF_DEPENDENT_VARIABLES = ['One', 'Multiple'].freeze
  NUMBER_OF_PREDICTORS = ['One', 'Multiple', 'None / Not Applicable'].freeze

  NUMBER_OF_GROUPS_CONDITIONS = ['One', 'Two', 'Three or More', 'None / Not Applicable'].freeze
  SAMPLE_RELATIONSHIPS = ['Independent', 'Paired / Matched', 'Repeated Measures', 'Mixed', 'None / Not Applicable'].freeze
  NUMBER_OF_TIMEPOINTS = ['One', 'Two', 'Three or More', 'Continuous / Event-Based', 'Not Applicable'].freeze

  SUPPORT_LEVELS = ['Not Supported', 'Supported', 'Required'].freeze
  DATA_HIERARCHIES = ['Single Level', 'Nested / Multilevel', 'Longitudinal', 'Cross-Classified', 'Unknown'].freeze

  YES_NO = ['Yes', 'No'].freeze
  YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'].freeze
  YES_NO_NA = ['Yes', 'No', 'Not Applicable'].freeze
  YES_NO_UNKNOWN_NA = ['Yes', 'No', 'Unknown', 'Not Applicable'].freeze

  AGREEMENT_DATA_TYPES = ['Continuous', 'Ordinal', 'Categorical', 'Not Applicable'].freeze
  POST_HOC_OPTIONS = ['Yes', 'No', 'Possibly', 'Not Applicable'].freeze
  ANALYSIS_SCOPES = ['Unadjusted / Bivariate', 'Adjusted / Multivariable', 'Multivariate'].freeze
  PRIMARY_OUTPUTS = [
    'Group Difference', 'Correlation', 'Regression Coefficient', 'Odds Ratio',
    'Hazard Ratio', 'Latent Factors', 'Clusters', 'Agreement Index', 'Fit Statistic'
  ].freeze
  ANALYSIS_PREFERENCE_LEVELS = ['Classical / Introductory', 'Robust', 'Bayesian', 'Machine Learning', 'No Preference'].freeze
  COMPLEXITY_LEVELS = ['Introductory', 'Intermediate', 'Advanced', 'Any'].freeze

  # Single-select string columns: { column => allowed_values }
  SINGLE_SELECT_FIELDS = {
    variable_relationship_structure: VARIABLE_RELATIONSHIP_STRUCTURES,
    primary_variable_1_type: PRIMARY_VARIABLE_1_TYPES,
    primary_variable_2_type: PRIMARY_VARIABLE_2_TYPES,
    number_of_dependent_variables: NUMBER_OF_DEPENDENT_VARIABLES,
    number_of_predictors: NUMBER_OF_PREDICTORS,
    number_of_groups_conditions: NUMBER_OF_GROUPS_CONDITIONS,
    sample_relationship: SAMPLE_RELATIONSHIPS,
    repeated_observations_present: YES_NO,
    number_of_timepoints: NUMBER_OF_TIMEPOINTS,
    time_matters_to_analysis: YES_NO,
    covariates_included: SUPPORT_LEVELS,
    nested_or_clustered_data: SUPPORT_LEVELS,
    data_hierarchy: DATA_HIERARCHIES,
    mediation: SUPPORT_LEVELS,
    moderation: SUPPORT_LEVELS,
    parametric_assumptions_reasonably_met: YES_NO_UNKNOWN,
    outcome_approximately_normal: YES_NO_UNKNOWN_NA,
    equal_variances_assumed: YES_NO_UNKNOWN_NA,
    small_sample_concern: YES_NO_UNKNOWN,
    small_expected_cell_counts: YES_NO_UNKNOWN_NA,
    overdispersion_present: YES_NO_UNKNOWN_NA,
    many_zero_values: YES_NO_UNKNOWN_NA,
    censoring_present: SUPPORT_LEVELS,
    latent_construct_interest: YES_NO,
    dimension_reduction_goal: YES_NO,
    group_membership_known_in_advance: YES_NO_NA,
    agreement_data_type: AGREEMENT_DATA_TYPES,
    post_hoc_comparisons_needed: POST_HOC_OPTIONS,
    analysis_scope: ANALYSIS_SCOPES,
    exact_method_needed: YES_NO_UNKNOWN,
    bayesian_approach_desired: YES_NO,
    analysis_preference_level: ANALYSIS_PREFERENCE_LEVELS,
    complexity_level_allowed: COMPLEXITY_LEVELS
  }.freeze

  # Multi-select JSON-array columns: { column => allowed_values }
  MULTI_SELECT_FIELDS = {
    goal: GOALS,
    primary_output_desired: PRIMARY_OUTPUTS
  }.freeze

  # ---------------------------------------------------------------------------
  # Validations
  # ---------------------------------------------------------------------------

  validates :name, presence: true, uniqueness: { case_sensitive: false }
  validates :slug, presence: true, uniqueness: true

  before_validation :ensure_slug
  before_save :normalize_aliases

  SINGLE_SELECT_FIELDS.each do |field, allowed|
    validates field, inclusion: { in: allowed, allow_blank: true }
  end

  validate :validate_multi_select_fields

  # ---------------------------------------------------------------------------
  # Scopes / queries
  # ---------------------------------------------------------------------------

  default_scope -> { order(:position, :name) }

  scope :search, ->(q) {
    next all if q.blank?
    pattern = "%#{q.to_s.downcase}%"
    where('LOWER(name) LIKE :p OR LOWER(aliases::text) LIKE :p OR LOWER(description) LIKE :p', p: pattern)
  }

  # Return the canonical test that matches the given name or any alias
  # (case-insensitive). Used by the autotagger to normalize Haiku output.
  def self.find_by_name_or_alias(query)
    return nil if query.blank?
    needle = query.to_s.strip.downcase
    all.detect do |t|
      t.name.to_s.downcase == needle ||
        Array(t.aliases).any? { |a| a.to_s.downcase == needle }
    end
  end

  def to_param
    slug
  end

  private

  def ensure_slug
    return if slug.present?
    self.slug = name.to_s.parameterize if name.present?
  end

  def normalize_aliases
    self.aliases = Array(aliases).map { |a| a.to_s.strip }.reject(&:blank?).uniq
  end

  def validate_multi_select_fields
    MULTI_SELECT_FIELDS.each do |field, allowed|
      values = Array(public_send(field))
      bad = values.reject { |v| allowed.include?(v) }
      errors.add(field, "contains invalid values: #{bad.join(', ')}") if bad.any?
    end
  end
end
