class SearchController < ApplicationController
  before_action :authenticate_user!

  def index
    query = params[:q]

    if query.blank?
      render json: { concepts: [], sources: [], people: [], notes: [], tags: [] }
      return
    end

    # Search across all entities
    concepts = current_user.concepts.where(
      "label ILIKE ? OR summary ILIKE ? OR description ILIKE ?",
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
      "title ILIKE ? OR body ILIKE ? OR context ILIKE ?",
      "%#{query}%", "%#{query}%", "%#{query}%"
    ).includes(:concept).limit(10)

    tags = current_user.tags.where(
      "name ILIKE ? OR description ILIKE ?",
      "%#{query}%", "%#{query}%"
    ).limit(10)

    render json: {
      query: query,
      concepts: concepts.as_json(only: [:id, :label, :concept_type, :summary]),
      sources: sources.as_json(only: [:id, :title, :kind, :authors]),
      people: people.as_json(only: [:id, :full_name, :role]),
      notes: notes.as_json(
        only: [:id, :title, :body, :note_type, :created_at],
        include: { concept: { only: [:id, :label] } }
      ),
      tags: tags.map { |tag|
        tag.as_json(only: [:id, :name, :description, :color]).merge(
          taggings_count: tag.taggings_count
        )
      }
    }
  end
end
