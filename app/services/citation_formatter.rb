# Generates citations for sources in the requested style.
#
# Supported formats: apa, chicago, mla, bibtex, ris.
# Each format handles articles, books, chapters, websites, and a generic fallback.
# Multiple sources can be formatted in one go via .render_list.
class CitationFormatter
  FORMATS = %w[apa apa_in_text chicago chicago_in_text mla mla_in_text bibtex ris].freeze
  IN_TEXT_FORMATS = %w[apa_in_text chicago_in_text mla_in_text].freeze

  def self.render(source, format)
    new(source, format).render
  end

  def self.render_list(sources, format)
    separator = if format == 'bibtex'
                  "\n\n"
                elsif IN_TEXT_FORMATS.include?(format)
                  '; '
                else
                  "\n"
                end
    sources.map { |s| new(s, format).render }.join(separator)
  end

  def initialize(source, format)
    @source = source
    @format = format.to_s.downcase
    @format = 'apa' unless FORMATS.include?(@format)
  end

  def render
    case @format
    when 'apa'             then apa
    when 'apa_in_text'     then apa_in_text
    when 'chicago'         then chicago
    when 'chicago_in_text' then chicago_in_text
    when 'mla'             then mla
    when 'mla_in_text'     then mla_in_text
    when 'bibtex'          then bibtex
    when 'ris'             then ris
    end
  end

  private

  # ---- Author helpers ----

  def authors
    if @source.respond_to?(:ordered_authors)
      legacy = @source.ordered_authors.to_a
      return legacy if legacy.any?
    end
    if @source.respond_to?(:person_sources)
      linked = @source.person_sources.includes(:person).order(:id)
                      .map(&:person).compact
      return linked if linked.any?
    end
    str = @source.respond_to?(:authors_string) ? @source.authors_string : nil
    return [] if str.blank?
    str.split(/[,;]/).map(&:strip).reject(&:blank?).map { |n| OpenStruct.new(full_name: n, first_name: nil, last_name: n) }
  rescue
    []
  end

  # Returns [given, family] for any author-like object. Tolerant of:
  #   - `full_name` stored as "Last, First" (extractor occasionally swaps)
  #   - `first_name` / `last_name` columns swapped, with a trailing comma
  #     leaking from the original "Last, First" string
  #   - bare strings or OpenStructs from the authors_string fallback path
  # The comma-in-full_name signal wins over the stored first/last fields,
  # since that's the most reliable indicator the columns are unreliable.
  def name_parts(author)
    full       = author.respond_to?(:full_name)  ? author.full_name.to_s.strip  : ''
    first_attr = author.respond_to?(:first_name) ? author.first_name.to_s.strip : ''
    last_attr  = author.respond_to?(:last_name)  ? author.last_name.to_s.strip  : ''
    first_attr = first_attr.sub(/[,;]+\z/, '')
    last_attr  = last_attr.sub(/[,;]+\z/, '')

    if full.include?(',')
      l, f = full.split(',', 2).map(&:strip)
      return [f.to_s, l.to_s] if l.present?
    end
    return [first_attr, last_attr] if first_attr.present? && last_attr.present?
    return ['', last_attr] if last_attr.present? && first_attr.blank?
    return [first_attr, ''] if first_attr.present? && last_attr.blank?

    tokens = full.split(/\s+/).reject(&:blank?)
    return ['', ''] if tokens.empty?
    return ['', tokens.first] if tokens.size == 1
    [tokens[0..-2].join(' '), tokens.last]
  end

  def given_initials(given)
    given.split(/[\s\-]+/).reject(&:blank?).map { |p| "#{p[0]}." }.join(' ')
  end

  def display_full_name(author)
    given, family = name_parts(author)
    [given, family].reject(&:blank?).join(' ').presence || family.presence || given
  end

  def apa_authors
    list = authors
    return '' if list.empty?
    formatted = list.map { |a| apa_name(a) }
    join_with_amp(formatted)
  end

  # "Last, F. M." (or just the family/given when one side is missing)
  def apa_name(author)
    given, family = name_parts(author)
    return family if given.blank? && family.present?
    return given if family.blank?
    "#{family}, #{given_initials(given)}"
  end

  def join_with_amp(list)
    return '' if list.empty?
    return list.first if list.size == 1
    return "#{list.first} & #{list.last}" if list.size == 2
    "#{list[0..-2].join(', ')}, & #{list.last}"
  end

  def mla_authors
    list = authors
    return '' if list.empty?
    case list.size
    when 1
      mla_invert(list.first)
    when 2
      "#{mla_invert(list.first)}, and #{display_full_name(list.last)}"
    else
      "#{mla_invert(list.first)}, et al."
    end
  end

  # "Last, First" form for the lead author in MLA / Chicago.
  def mla_invert(author)
    given, family = name_parts(author)
    return given if family.blank?
    return family if given.blank?
    "#{family}, #{given}"
  end

  def chicago_authors
    list = authors
    return '' if list.empty?
    case list.size
    when 1 then mla_invert(list.first)
    when 2 then "#{mla_invert(list.first)}, and #{display_full_name(list.last)}"
    else
      formatted = [mla_invert(list.first)] + list[1..].map { |a| display_full_name(a) }
      formatted[0..-2].join(', ') + ', and ' + formatted.last
    end
  end

  def bibtex_authors
    list = authors
    list.map { |a| display_full_name(a) }.join(' and ')
  end

  def year
    @source.year || @source.publication_date&.year
  end

  def title
    @source.title.to_s.strip
  end

  def journal
    @source.journal_name
  end

  def volume_issue_pages
    parts = []
    parts << @source.volume if @source.volume.present?
    parts << "(#{@source.issue})" if @source.issue.present?
    base = parts.join('')
    base += ", #{@source.pages}" if @source.pages.present?
    base
  end

  def doi_segment
    @source.doi.present? ? "https://doi.org/#{@source.doi}" : nil
  end

  # ---- Format implementations ----

  def apa
    yr = year || 'n.d.'
    parts = ["#{apa_authors} (#{yr}). #{title}."]
    if journal.present?
      tail = journal.dup
      vip = volume_issue_pages
      tail += ", #{vip}" if vip.present?
      parts << tail.strip + '.'
    elsif @source.publisher_or_venue.present?
      parts << "#{@source.publisher_or_venue}."
    end
    parts << doi_segment if doi_segment
    parts.join(' ').squeeze(' ')
  end

  def chicago
    yr = year || 'n.d.'
    if journal.present?
      base = %{#{chicago_authors}. #{yr}. "#{title}." #{journal}}
      base += " #{@source.volume}" if @source.volume.present?
      base += ", no. #{@source.issue}" if @source.issue.present?
      base += " (#{yr})"
      base += ": #{@source.pages}" if @source.pages.present?
      base += '.'
      base += " https://doi.org/#{@source.doi}." if @source.doi.present?
      base
    else
      base = %{#{chicago_authors}. #{yr}. #{title}}
      base += ". #{@source.publisher_or_venue}" if @source.publisher_or_venue.present?
      base += '.'
      base
    end
  end

  def mla
    parts = []
    parts << "#{mla_authors}." if mla_authors.present?
    parts << %{"#{title}."}
    if journal.present?
      tail = journal.dup
      tail += ", vol. #{@source.volume}" if @source.volume.present?
      tail += ", no. #{@source.issue}" if @source.issue.present?
      tail += ", #{year}" if year
      tail += ", pp. #{@source.pages}" if @source.pages.present?
      tail += '.'
      parts << tail
    elsif @source.publisher_or_venue.present?
      parts << "#{@source.publisher_or_venue}, #{year}."
    end
    parts << "https://doi.org/#{@source.doi}." if @source.doi.present?
    parts.join(' ')
  end

  # ---- In-text variants ----

  def last_name_of(author)
    name_parts(author).last
  end

  def in_text_authors_apa
    list = authors
    return 'Anonymous' if list.empty?
    names = list.map { |a| last_name_of(a) }.reject(&:blank?)
    case names.size
    when 0 then 'Anonymous'
    when 1 then names.first
    when 2 then "#{names.first} & #{names.last}"
    else        "#{names.first} et al."
    end
  end

  def in_text_authors_narrative
    list = authors
    return '' if list.empty?
    names = list.map { |a| last_name_of(a) }.reject(&:blank?)
    case names.size
    when 0 then ''
    when 1 then names.first
    when 2 then "#{names.first} and #{names.last}"
    else        "#{names.first} et al."
    end
  end

  def first_page
    return nil unless @source.pages.present?
    @source.pages.to_s.split(/[-–—]/).first.to_s.strip.presence
  end

  def apa_in_text
    yr = year || 'n.d.'
    "(#{in_text_authors_apa}, #{yr})"
  end

  def chicago_in_text
    yr = year || 'n.d.'
    auth = in_text_authors_narrative
    auth = 'Anonymous' if auth.blank?
    page = first_page
    page ? "(#{auth} #{yr}, #{page})" : "(#{auth} #{yr})"
  end

  def mla_in_text
    auth = in_text_authors_narrative
    auth = 'Anonymous' if auth.blank?
    page = first_page
    page ? "(#{auth} #{page})" : "(#{auth})"
  end

  def bibtex
    type = case @source.kind.to_s
           when 'book' then 'book'
           when 'book_chapter' then 'incollection'
           when 'thesis', 'dissertation' then 'phdthesis'
           when 'conference' then 'inproceedings'
           when 'report' then 'techreport'
           else 'article'
           end
    fields = {}
    fields[:author]    = bibtex_authors if bibtex_authors.present?
    fields[:title]     = title
    fields[:year]      = year if year
    fields[:journal]   = journal if journal.present?
    fields[:volume]    = @source.volume if @source.volume.present?
    fields[:number]    = @source.issue if @source.issue.present?
    fields[:pages]     = @source.pages if @source.pages.present?
    fields[:publisher] = @source.publisher_or_venue if @source.publisher_or_venue.present? && type != 'article'
    fields[:doi]       = @source.doi if @source.doi.present?
    fields[:url]       = @source.url if @source.url.present?
    fields[:isbn]      = @source.isbn if @source.respond_to?(:isbn) && @source.isbn.present?

    "@#{type}{#{bibtex_key},\n" +
      fields.map { |k, v| "  #{k} = {#{escape_bibtex(v)}}" }.join(",\n") +
      "\n}"
  end

  def bibtex_key
    first = authors.first
    last = (first ? last_name_of(first) : nil).presence || 'source'
    "#{last.gsub(/[^A-Za-z]/, '').downcase}#{year || @source.id}"
  end

  def escape_bibtex(v)
    v.to_s.gsub('{', '\{').gsub('}', '\}')
  end

  def ris
    type = case @source.kind.to_s
           when 'book' then 'BOOK'
           when 'book_chapter' then 'CHAP'
           when 'thesis', 'dissertation' then 'THES'
           when 'conference' then 'CONF'
           when 'report' then 'RPRT'
           when 'website' then 'ELEC'
           else 'JOUR'
           end
    lines = []
    lines << "TY  - #{type}"
    authors.each do |a|
      given, family = name_parts(a)
      ris_name = family.present? && given.present? ? "#{family}, #{given}" : display_full_name(a)
      lines << "AU  - #{ris_name}" if ris_name.present?
    end
    lines << "TI  - #{title}"
    lines << "PY  - #{year}" if year
    lines << "JO  - #{journal}" if journal.present?
    lines << "VL  - #{@source.volume}" if @source.volume.present?
    lines << "IS  - #{@source.issue}" if @source.issue.present?
    if @source.pages.present?
      sp, ep = @source.pages.to_s.split(/[-–—]/, 2).map(&:strip)
      lines << "SP  - #{sp}" if sp.present?
      lines << "EP  - #{ep}" if ep.present?
    end
    lines << "PB  - #{@source.publisher_or_venue}" if @source.publisher_or_venue.present?
    lines << "DO  - #{@source.doi}" if @source.doi.present?
    lines << "UR  - #{@source.url}" if @source.url.present?
    lines << "AB  - #{@source.abstract}" if @source.abstract.present?
    lines << "ER  - "
    lines.join("\n")
  end
end
