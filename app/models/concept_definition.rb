class ConceptDefinition < ApplicationRecord
  CONCEPT_TYPES = %w[
    phenomenon theory pathology anatomy intervention
    process measurement method field
  ].freeze

  # A definition is hidden from cache lookups once it's been rejected this
  # many times.  Existing concepts linked to it stay linked — we only stop
  # offering it as a match for new users.
  REJECTION_THRESHOLD = 3

  has_many :concepts, foreign_key: :definition_id, dependent: :nullify

  has_many :concept_definition_domains, dependent: :destroy
  has_many :domains, through: :concept_definition_domains
  has_many :linkings, as: :linkable, dependent: :destroy
  has_many :links, through: :linkings

  validates :label, presence: true

  before_validation :ensure_slug

  # Returns the best cached definition for a (slug, concept_type) pair, or
  # nil.  Filters out rejection-demoted rows; orders by fewest rejections,
  # then most-linked, then freshest.  Caller is responsible for not calling
  # this when concept_type is blank — slug-only matches risk wrong-sense
  # collisions ("Depression" pathology vs phenomenon).
  def self.best_match_for(slug:, concept_type:)
    return nil if slug.blank? || concept_type.blank?
    where(slug: slug, concept_type: concept_type)
      .where("rejection_count < ?", REJECTION_THRESHOLD)
      .order(rejection_count: :asc, linked_count_cache: :desc, created_at: :desc)
      .first
  end

  private

  def ensure_slug
    self.slug = label.to_s.parameterize if slug.blank? && label.present?
  end
end
