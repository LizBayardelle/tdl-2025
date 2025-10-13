class NoteLink < ApplicationRecord
  belongs_to :note
  belongs_to :linked, polymorphic: true

  validates :link_type, presence: true, inclusion: {
    in: %w[references elaborates contrasts synthesizes builds_on questions inspired_by],
    message: "%{value} is not a valid link type"
  }
  validates :relevance, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: 5,
    allow_nil: true
  }
end
