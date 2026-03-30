class Link < ApplicationRecord
  has_many :linkings, dependent: :destroy
  has_many :concepts, through: :linkings, source: :linkable, source_type: 'Concept'
  has_many :concept_definitions, through: :linkings, source: :linkable, source_type: 'ConceptDefinition'

  validates :name, presence: true
  validates :url, presence: true
end
