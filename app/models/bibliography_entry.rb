class BibliographyEntry < ApplicationRecord
  belongs_to :collection
  belongs_to :source

  # One annotation entry per source within a given collection's bibliography.
  validates :source_id, uniqueness: { scope: :collection_id }
end
