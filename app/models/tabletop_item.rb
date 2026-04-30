class TabletopItem < ApplicationRecord
  ENTITY_KINDS = %w[note source concept].freeze
  DECOR_KINDS  = %w[header text arrow frame].freeze
  KINDS        = ENTITY_KINDS + DECOR_KINDS

  belongs_to :tabletop
  belongs_to :item, polymorphic: true, optional: true

  validates :kind, inclusion: { in: KINDS }
  validate  :entity_kinds_have_item

  def entity?
    ENTITY_KINDS.include?(kind)
  end

  def decoration?
    DECOR_KINDS.include?(kind)
  end

  private

  def entity_kinds_have_item
    return unless entity?
    errors.add(:item, 'must be set for entity items') if item_id.blank? || item_type.blank?
  end
end
