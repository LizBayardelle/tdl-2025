class Collection < ApplicationRecord
  belongs_to :user
  has_many :collection_items, dependent: :destroy
  has_many :shares, as: :shareable, dependent: :destroy

  # Polymorphic associations
  has_many :sources, through: :collection_items, source: :collectable, source_type: 'Source'
  has_many :concepts, through: :collection_items, source: :collectable, source_type: 'Concept'
  has_many :people, through: :collection_items, source: :collectable, source_type: 'Person'
  has_many :notes, through: :collection_items, source: :collectable, source_type: 'Note'

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :user_id }

  before_validation :generate_slug, on: :create

  def items_count
    collection_items.count
  end

  def add_item(item, include_related: false, added_by: nil)
    collection_items.find_or_create_by!(
      collectable: item,
      added_by: added_by || user
    )

    add_related_items(item, added_by: added_by) if include_related
  end

  def add_related_items(item, added_by: nil)
    case item
    when Source
      item.concepts.each { |c| add_item(c, added_by: added_by) }
      item.people.each { |p| add_item(p, added_by: added_by) }
      item.notes.each { |n| add_item(n, added_by: added_by) }
    when Concept
      item.sources.each { |s| add_item(s, added_by: added_by) }
      item.people.each { |p| add_item(p, added_by: added_by) }
      item.linked_notes.each { |n| add_item(n, added_by: added_by) }
    when Person
      item.sources.each { |s| add_item(s, added_by: added_by) }
      item.concepts.each { |c| add_item(c, added_by: added_by) }
      item.notes.each { |n| add_item(n, added_by: added_by) }
    when Note
      item.source&.then { |s| add_item(s, added_by: added_by) }
      item.concepts.each { |c| add_item(c, added_by: added_by) }
      item.people.each { |p| add_item(p, added_by: added_by) }
    end
  end

  def shared_with?(user)
    return true if user_id == user.id
    shares.active.exists?(recipient: user)
  end

  def collaboratable_by?(user)
    return true if user_id == user.id
    shares.active.where(recipient: user, permission: 'collaborator').exists?
  end

  private

  def generate_slug
    self.slug ||= name&.parameterize
  end
end
