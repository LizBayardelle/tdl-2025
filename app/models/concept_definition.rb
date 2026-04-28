class ConceptDefinition < ApplicationRecord
  CONCEPT_TYPES = %w[
    phenomenon theory pathology anatomy intervention
    process measurement method field
  ].freeze

  belongs_to :pack, optional: true, counter_cache: :concept_count
  has_many :concepts, foreign_key: :definition_id, dependent: :nullify

  has_many :concept_definition_domains, dependent: :destroy
  has_many :domains, through: :concept_definition_domains
  has_many :linkings, as: :linkable, dependent: :destroy
  has_many :links, through: :linkings

  validates :label, presence: true
end
