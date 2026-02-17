module Shareable
  extend ActiveSupport::Concern

  included do
    has_many :shares, as: :shareable, dependent: :destroy
    has_many :collection_items, as: :collectable, dependent: :destroy
    has_many :collections, through: :collection_items
  end

  def shared_with?(user)
    return true if user_id == user.id

    # Direct share on this item
    return true if shares.active.exists?(recipient: user)

    # Via collection share
    collections.joins(:shares)
      .where(shares: { recipient_id: user.id, active: true })
      .exists?
  end

  def permission_for(user)
    return 'owner' if user_id == user.id

    # Check direct share first
    direct = shares.active.find_by(recipient: user)
    return direct.permission if direct

    # Check collection shares
    collection_share = Share.active
      .where(recipient: user, shareable_type: 'Collection')
      .joins("INNER JOIN collection_items ON collection_items.collection_id = shares.shareable_id")
      .where(collection_items: { collectable_type: self.class.name, collectable_id: id })
      .order(Arel.sql("CASE shares.permission
                        WHEN 'collaborator' THEN 1
                        WHEN 'editor' THEN 2
                        WHEN 'viewer' THEN 3 END"))
      .first

    collection_share&.permission
  end

  def editable_by?(user)
    %w[owner editor collaborator].include?(permission_for(user))
  end

  def collaboratable_by?(user)
    %w[owner collaborator].include?(permission_for(user))
  end
end
