class Tag < ApplicationRecord
  belongs_to :user
  has_many :taggings, dependent: :destroy

  # Polymorphic associations through taggings
  has_many :nodes, through: :taggings, source: :taggable, source_type: 'Node'
  has_many :sources, through: :taggings, source: :taggable, source_type: 'Source'
  has_many :people, through: :taggings, source: :taggable, source_type: 'Person'
  has_many :edges, through: :taggings, source: :taggable, source_type: 'Edge'
  has_many :notes, through: :taggings, source: :taggable, source_type: 'Note'

  # Validations
  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :user_id }
  validates :user_id, presence: true

  # Callbacks
  before_validation :generate_slug, if: -> { name.present? && slug.blank? }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :alphabetical, -> { order(:name) }
  scope :by_popularity, -> {
    left_joins(:taggings)
      .group(:id)
      .order('COUNT(taggings.id) DESC')
  }

  # Get count of all tagged items
  def taggings_count
    taggings.count
  end

  # Get counts by type
  def taggings_by_type
    taggings.group(:taggable_type).count
  end

  private

  def generate_slug
    self.slug = name.parameterize
  end
end
