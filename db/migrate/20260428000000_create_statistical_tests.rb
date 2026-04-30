class CreateStatisticalTests < ActiveRecord::Migration[7.1]
  def change
    create_table :statistical_tests do |t|
      # Identification
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.json :aliases, default: []
      t.integer :position, default: 0, null: false

      # Purpose (multi-select)
      t.json :goal, default: []

      # Variable structure
      t.string :variable_relationship_structure
      t.string :primary_variable_1_type
      t.string :primary_variable_2_type
      t.string :number_of_dependent_variables
      t.string :number_of_predictors

      # Design structure
      t.string :number_of_groups_conditions
      t.string :sample_relationship
      t.string :repeated_observations_present
      t.string :number_of_timepoints
      t.string :time_matters_to_analysis

      # Model structure
      t.string :covariates_included
      t.string :nested_or_clustered_data
      t.string :data_hierarchy
      t.string :mediation
      t.string :moderation

      # Assumptions / edge cases
      t.string :parametric_assumptions_reasonably_met
      t.string :outcome_approximately_normal
      t.string :equal_variances_assumed
      t.string :small_sample_concern
      t.string :small_expected_cell_counts
      t.string :overdispersion_present
      t.string :many_zero_values
      t.string :censoring_present

      # Special analysis types
      t.string :latent_construct_interest
      t.string :dimension_reduction_goal
      t.string :group_membership_known_in_advance
      t.string :agreement_data_type

      # Output / practical
      t.string :post_hoc_comparisons_needed
      t.string :analysis_scope
      t.json :primary_output_desired, default: []

      # Advanced
      t.string :exact_method_needed
      t.string :bayesian_approach_desired
      t.string :analysis_preference_level
      t.string :complexity_level_allowed

      t.timestamps
    end

    add_index :statistical_tests, :name, unique: true
    add_index :statistical_tests, :slug, unique: true
    add_index :statistical_tests, :position
  end
end
