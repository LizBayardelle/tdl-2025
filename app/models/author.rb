class Author < ApplicationRecord
  belongs_to :user
  has_many :source_authors, dependent: :destroy
  has_many :sources, through: :source_authors

  # Validations
  validates :user_id, presence: true
  validates :full_name, presence: true

  # Callbacks
  before_validation :generate_full_name, if: -> { full_name.blank? }

  # Scopes
  scope :alphabetical, -> { order(:last_name, :first_name) }

  private

  def generate_full_name
    parts = [last_name]
    parts << "#{first_name.first}." if first_name.present?
    parts << "#{middle_initial}." if middle_initial.present?
    self.full_name = parts.join(' ')
  end
end
