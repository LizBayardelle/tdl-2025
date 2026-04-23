class AllowedDomain < ApplicationRecord
  belongs_to :added_by, class_name: 'User', optional: true

  validates :domain, presence: true, uniqueness: { case_sensitive: false }
  before_validation :normalize_domain

  scope :active, -> { where(active: true) }

  def self.active_domains
    active.order(:domain).pluck(:domain)
  end

  private

  def normalize_domain
    return if domain.blank?

    normalized = domain.strip.downcase
    normalized = normalized.sub(%r{\Ahttps?://}, '')
    normalized = normalized.sub(%r{/.*\z}, '')
    normalized = normalized.sub(/\Awww\./, '')
    self.domain = normalized
  end
end
