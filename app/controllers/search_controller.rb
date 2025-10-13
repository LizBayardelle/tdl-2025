class SearchController < ApplicationController
  before_action :authenticate_user!

  def index
    query = params[:q]

    if query.blank?
      render json: { nodes: [], sources: [], people: [], notes: [], tags: [] }
      return
    end

    # Search across all entities
    nodes = current_user.nodes.where(
      "label ILIKE ? OR summary_top ILIKE ? OR summary_mid ILIKE ?",
      "%#{query}%", "%#{query}%", "%#{query}%"
    ).limit(10)

    sources = current_user.sources.where(
      "title ILIKE ? OR authors ILIKE ? OR summary ILIKE ?",
      "%#{query}%", "%#{query}%", "%#{query}%"
    ).limit(10)

    people = current_user.people.where(
      "full_name ILIKE ? OR summary ILIKE ?",
      "%#{query}%", "%#{query}%"
    ).limit(10)

    notes = current_user.notes.where(
      "body ILIKE ? OR context ILIKE ?",
      "%#{query}%", "%#{query}%"
    ).includes(:node).limit(10)

    tags = current_user.tags.where(
      "name ILIKE ? OR description ILIKE ?",
      "%#{query}%", "%#{query}%"
    ).limit(10)

    render json: {
      query: query,
      nodes: nodes.as_json(only: [:id, :label, :node_type, :summary_top]),
      sources: sources.as_json(only: [:id, :title, :kind, :authors]),
      people: people.as_json(only: [:id, :full_name, :role]),
      notes: notes.as_json(
        only: [:id, :body, :note_type, :created_at],
        include: { node: { only: [:id, :label] } }
      ),
      tags: tags.map { |tag|
        tag.as_json(only: [:id, :name, :description, :color]).merge(
          taggings_count: tag.taggings_count
        )
      }
    }
  end
end
