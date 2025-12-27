class Person < ApplicationRecord
  include Taggable

  belongs_to :user
  has_many :people_concepts, class_name: 'PersonConcept', dependent: :destroy
  has_many :concepts, through: :people_concepts
  has_many :people_sources, class_name: 'PersonSource', dependent: :restrict_with_error
  has_many :sources, through: :people_sources
  has_many :people_notes, class_name: 'PersonNote', dependent: :restrict_with_error
  has_many :notes, through: :people_notes

  # Enums
  enum :role, {
    theorist: "theorist",
    clinician: "clinician",
    researcher: "researcher",
    peer: "peer",
    client: "client"
  }, prefix: true

  # Callbacks
  before_validation :build_full_name

  # Validations
  validates :user_id, presence: true
  validate :name_presence

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_role, ->(role) { where(role: role) }
  scope :alphabetical, -> { order(:full_name) }

  private

  def build_full_name
    # If we have component name fields, construct full_name from them
    if first_name.present? || last_name.present?
      parts = [first_name, middle_name, last_name].compact.reject(&:blank?)
      self.full_name = parts.join(' ') if parts.any?
    end
  end

  def name_presence
    if full_name.blank? && first_name.blank? && last_name.blank?
      errors.add(:base, "Must provide either full name or first/last name")
    end
  end

  public

  # Get all connections involving this person's concepts
  def related_connections
    concept_ids = concepts.pluck(:id)
    return Connection.none if concept_ids.empty?

    Connection.where("src_concept_id IN (?) OR dst_concept_id IN (?)", concept_ids, concept_ids)
              .includes(:src_concept, :dst_concept)
              .order(created_at: :desc)
  end
end
