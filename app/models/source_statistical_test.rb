class SourceStatisticalTest < ApplicationRecord
  belongs_to :source
  belongs_to :statistical_test

  validates :statistical_test_id, uniqueness: { scope: :source_id }
  validates :confidence, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1, allow_nil: true }
end
