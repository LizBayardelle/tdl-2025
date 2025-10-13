class Source < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :node_sources, dependent: :destroy
  has_many :nodes, through: :node_sources
  has_many :person_sources, dependent: :destroy
  has_many :people, through: :person_sources

  # Enums
  enum :kind, {
    manual: "manual",
    textbook: "textbook",
    rct: "rct",
    meta_analysis: "meta_analysis",
    guideline: "guideline",
    video_demo: "video_demo",
    article: "article",
    chapter: "chapter"
  }, prefix: true

  # Validations
  validates :title, presence: true
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_kind, ->(kind) { where(kind: kind) }
  scope :by_year, ->(year) { where(year: year) }
end
