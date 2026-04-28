# Migrate concept_type values from the original 11-category snake_case
# taxonomy to the new 9-category plain-language taxonomy.
#
# Old → New mapping:
#   research_method        → method
#   school_of_thought      → theory
#   emotion                → phenomenon
#   symptom                → phenomenon
#   non_physical_concept   → phenomenon
#   physical_entity        → anatomy
#   physical_process       → process
#   non_physical_process   → process
#   pathology, intervention, measurement → unchanged
#   (new: field — no automatic backfill, users opt in manually)
class UpdateConceptTypeTaxonomy < ActiveRecord::Migration[7.1]
  MAPPING = {
    "research_method"      => "method",
    "school_of_thought"    => "theory",
    "emotion"              => "phenomenon",
    "symptom"              => "phenomenon",
    "non_physical_concept" => "phenomenon",
    "physical_entity"      => "anatomy",
    "physical_process"     => "process",
    "non_physical_process" => "process",
  }.freeze

  REVERSE_MAPPING = {
    "method"     => "research_method",
    "theory"     => "school_of_thought",
    "phenomenon" => "non_physical_concept", # best-effort; can't recover originals
    "anatomy"    => "physical_entity",
    "process"    => "physical_process",
  }.freeze

  def up
    MAPPING.each do |old_value, new_value|
      execute "UPDATE concepts SET concept_type = #{quote_value(new_value)} WHERE concept_type = #{quote_value(old_value)}"
      execute "UPDATE concept_definitions SET concept_type = #{quote_value(new_value)} WHERE concept_type = #{quote_value(old_value)}" if table_exists?(:concept_definitions)
    end
  end

  def down
    REVERSE_MAPPING.each do |new_value, old_value|
      execute "UPDATE concepts SET concept_type = #{quote_value(old_value)} WHERE concept_type = #{quote_value(new_value)}"
      execute "UPDATE concept_definitions SET concept_type = #{quote_value(old_value)} WHERE concept_type = #{quote_value(new_value)}" if table_exists?(:concept_definitions)
    end
  end

  private

  def quote_value(v)
    ActiveRecord::Base.connection.quote(v)
  end
end
