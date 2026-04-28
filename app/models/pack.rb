class Pack < ApplicationRecord
  has_many :concept_definitions, dependent: :destroy
  has_many :user_packs, dependent: :destroy
  has_many :users, through: :user_packs

  validates :name, presence: true

  scope :published, -> { where(published: true) }
  scope :free, -> { where(price_cents: 0) }
  scope :homepage_featured, -> { published.where(show_on_homepage: true) }
end
