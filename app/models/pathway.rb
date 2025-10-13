class Pathway < ApplicationRecord
  belongs_to :user

  # Validations
  validates :name, presence: true
  validates :user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :alphabetical, -> { order(:name) }

  # Get nodes in the pathway
  def nodes
    return [] if node_sequence.blank?

    node_ids = node_sequence.map { |item| item['node_id'] || item[:node_id] }.compact
    Node.where(id: node_ids, user: user).index_by(&:id).slice(*node_ids).values
  end

  # Add a node to the pathway
  def add_node(node_id, metadata = {})
    self.node_sequence ||= []
    self.node_sequence << { node_id: node_id, **metadata }
    save
  end

  # Remove a node from the pathway
  def remove_node(node_id)
    return unless node_sequence
    self.node_sequence = node_sequence.reject { |item| (item['node_id'] || item[:node_id]) == node_id }
    save
  end

  # Reorder nodes in the pathway
  def reorder_nodes(ordered_node_ids)
    return unless node_sequence

    # Create a hash of existing items by node_id for quick lookup
    items_by_id = node_sequence.each_with_object({}) do |item, hash|
      hash[(item['node_id'] || item[:node_id])] = item
    end

    # Rebuild sequence in new order
    self.node_sequence = ordered_node_ids.map { |id| items_by_id[id] }.compact
    save
  end
end
