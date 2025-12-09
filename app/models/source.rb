class Source < ApplicationRecord
  include Taggable

  belongs_to :user

  # Authors (many-to-many with ordering)
  has_many :source_authors, dependent: :destroy
  has_many :authors, through: :source_authors

  # Concepts and People
  has_many :concept_sources, dependent: :destroy
  has_many :concepts, through: :concept_sources
  has_many :person_sources, dependent: :destroy
  has_many :people, through: :person_sources

  # Notes
  has_many :notes, dependent: :nullify

  # PDF Attachment
  has_one_attached :pdf

  # Enums
  enum :kind, {
    manual: "manual",
    textbook: "textbook",
    rct: "rct",
    meta_analysis: "meta_analysis",
    guideline: "guideline",
    video_demo: "video_demo",
    article: "article",
    chapter: "chapter"
  }, prefix: true

  # Validations
  validates :title, presence: true
  validates :user_id, presence: true
  validates :url, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true }
  validates :doi, uniqueness: true, allow_blank: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_kind, ->(kind) { where(kind: kind) }
  scope :by_year, ->(year) { where(year: year) }
  scope :by_journal, ->(journal) { where(journal_name: journal) }
  scope :with_doi, -> { where.not(doi: nil) }

  # Get ordered authors as array
  def ordered_authors
    authors.joins(:source_authors)
           .where(source_authors: { source_id: id })
           .order('source_authors.position ASC')
  end

  # Generate APA citation based on source type
  def generate_citation
    case kind
    when 'article'
      generate_article_citation
    when 'textbook', 'manual'
      generate_book_citation
    when 'chapter'
      generate_chapter_citation
    when 'website'
      generate_website_citation
    else
      generate_generic_citation
    end
  end

  private

  def generate_article_citation
    author_list = ordered_authors.map(&:full_name).join(', ')
    pub_year = year || publication_date&.year || 'n.d.'

    citation = "#{author_list} (#{pub_year}). #{title}."
    citation += " #{journal_name}," if journal_name.present?
    citation += " #{volume}" if volume.present?
    citation += "(#{issue})" if issue.present?
    citation += ", #{pages}." if pages.present?
    citation += " https://doi.org/#{doi}" if doi.present?

    citation
  end

  def generate_book_citation
    author_list = ordered_authors.map(&:full_name).join(', ')
    pub_year = year || 'n.d.'

    citation = "#{author_list} (#{pub_year}). #{title}"
    citation += " (#{edition})" if edition.present?
    citation += ". #{publisher_or_venue}." if publisher_or_venue.present?

    citation
  end

  def generate_chapter_citation
    author_list = ordered_authors.map(&:full_name).join(', ')
    pub_year = year || 'n.d.'

    citation = "#{author_list} (#{pub_year}). #{title}."
    citation += " In #{book_title}" if book_title.present?
    citation += " (#{edition})" if edition.present?
    citation += " (pp. #{pages})" if pages.present?
    citation += ". #{publisher_or_venue}." if publisher_or_venue.present?

    citation
  end

  def generate_website_citation
    author_list = ordered_authors.any? ? ordered_authors.map(&:full_name).join(', ') : website_name
    access_year = access_date&.year || Date.current.year

    citation = "#{author_list} (#{access_year}). #{title}."
    citation += " #{website_name}." if website_name.present? && ordered_authors.any?
    citation += " #{url}" if url.present?

    citation
  end

  def generate_generic_citation
    author_list = ordered_authors.map(&:full_name).join(', ')
    pub_year = year || 'n.d.'

    citation = "#{author_list} (#{pub_year}). #{title}."
    citation += " #{publisher_or_venue}." if publisher_or_venue.present?

    citation
  end
end
