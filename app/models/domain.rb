class Domain < ApplicationRecord
  belongs_to :parent, class_name: "Domain", optional: true
  has_many :children, class_name: "Domain", foreign_key: :parent_id, dependent: :nullify

  has_many :concept_domains, dependent: :destroy
  has_many :concepts, through: :concept_domains

  has_many :concept_definition_domains, dependent: :destroy
  has_many :concept_definitions, through: :concept_definition_domains

  validates :name, presence: true, uniqueness: true

  scope :roots, -> { where(parent_id: nil) }
  scope :defaults, -> { where(is_default: true) }
end
