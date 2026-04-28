class SearchController < ApplicationController
  before_action :authenticate_user!

  def index
    @query = params[:q].to_s.strip
    @limit = limit_param

    respond_to do |format|
      format.html # mounts SearchPage React component, which fetches via JSON
      format.json { render json: search_payload }
    end
  end

  private

  def limit_param
    raw = params[:limit].to_i
    return 10 if raw <= 0
    [raw, 50].min
  end

  def search_payload
    if @query.blank?
      return { query: @query, totals: empty_totals, concepts: [], sources: [], people: [], notes: [], tags: [], collections: [] }
    end

    pattern = "%#{ActiveRecord::Base.sanitize_sql_like(@query)}%"

    concepts = current_user.concepts
                            .where("label ILIKE ? OR summary ILIKE ? OR description ILIKE ?", pattern, pattern, pattern)
                            .limit(@limit)
    sources  = current_user.sources
                            .where("title ILIKE ? OR authors ILIKE ? OR summary ILIKE ?", pattern, pattern, pattern)
                            .limit(@limit)
    people   = current_user.people
                            .where("full_name ILIKE ? OR summary ILIKE ?", pattern, pattern)
                            .limit(@limit)
    notes    = current_user.notes
                            .where("title ILIKE ? OR body ILIKE ? OR context ILIKE ?", pattern, pattern, pattern)
                            .includes(:source, :concepts)
                            .limit(@limit)
    tags     = current_user.tags
                            .where("name ILIKE ? OR description ILIKE ?", pattern, pattern)
                            .limit(@limit)
    collections = current_user.collections
                            .where("name ILIKE ? OR description ILIKE ?", pattern, pattern)
                            .limit(@limit)

    {
      query: @query,
      totals: {
        concepts: concepts.size,
        sources: sources.size,
        people: people.size,
        notes: notes.size,
        tags: tags.size,
        collections: collections.size,
      },
      concepts: concepts.as_json(only: [:id, :label, :slug, :concept_type, :summary]),
      sources:  sources.as_json(only: [:id, :title, :kind, :authors, :year, :journal_name]),
      people:   people.as_json(only: [:id, :full_name, :role, :summary]),
      notes:    notes.as_json(
        only: [:id, :title, :body, :note_type, :pinned, :created_at],
        include: {
          source:   { only: [:id, :title] },
          concepts: { only: [:id, :label] },
        },
      ),
      tags: tags.map { |t| t.as_json(only: [:id, :name, :description, :color]).merge(taggings_count: t.taggings_count) },
      collections: collections.as_json(only: [:id, :name, :description]),
    }
  end

  def empty_totals
    { concepts: 0, sources: 0, people: 0, notes: 0, tags: 0, collections: 0 }
  end
end
