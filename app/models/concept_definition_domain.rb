class ConceptDefinitionDomain < ApplicationRecord
  belongs_to :concept_definition
  belongs_to :domain
end
