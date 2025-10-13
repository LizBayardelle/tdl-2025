class PersonNote < ApplicationRecord
  self.table_name = 'people_notes'

  belongs_to :person
  belongs_to :note

  validates :rel_type, presence: true, inclusion: {
    in: %w[mentioned inspired_by case_subject critiqued_by influenced contributed_to],
    message: "%{value} is not a valid relationship type"
  }
  validates :prominence, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 1,
    less_than_or_equal_to: 5,
    allow_nil: true
  }
end
