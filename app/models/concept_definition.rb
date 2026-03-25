class ConceptDefinition < ApplicationRecord
  CONCEPT_TYPES = %w[
    research_method measurement intervention pathology emotion symptom
    school_of_thought physical_entity physical_process non_physical_process
    non_physical_concept
  ].freeze

  belongs_to :pack, optional: true, counter_cache: :concept_count
  has_many :concepts, foreign_key: :definition_id, dependent: :nullify

  has_many :concept_definition_domains, dependent: :destroy
  has_many :domains, through: :concept_definition_domains

  validates :label, presence: true
end
