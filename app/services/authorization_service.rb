class AuthorizationService
  attr_reader :user

  def initialize(user)
    @user = user
  end

  # Get all accessible IDs for a resource type
  def accessible_ids(klass)
    # Own items
    owned = klass.where(user_id: user.id).pluck(:id)

    # Directly shared items
    direct = Share.active
      .where(recipient: user, shareable_type: klass.name)
      .pluck(:shareable_id)

    # Items in shared collections
    via_collections = CollectionItem
      .joins(collection: :shares)
      .where(shares: { recipient_id: user.id, active: true })
      .where(collectable_type: klass.name)
      .pluck(:collectable_id)

    (owned + direct + via_collections).uniq
  end

  def can_view?(resource)
    resource.shared_with?(user)
  end

  def can_edit?(resource)
    resource.editable_by?(user)
  end

  def can_collaborate?(resource)
    resource.collaboratable_by?(user)
  end
end
