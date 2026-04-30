# Generates citations for sources in the requested style.
#
# Supported formats: apa, chicago, mla, bibtex, ris.
# Each format handles articles, books, chapters, websites, and a generic fallback.
# Multiple sources can be formatted in one go via .render_list.
class CitationFormatter
  FORMATS = %w[apa chicago mla bibtex ris].freeze

  def self.render(source, format)
    new(source, format).render
  end

  def self.render_list(sources, format)
    sources.map { |s| new(s, format).render }.join(format == 'bibtex' ? "\n\n" : "\n")
  end

  def initialize(source, format)
    @source = source
    @format = format.to_s.downcase
    @format = 'apa' unless FORMATS.include?(@format)
  end

  def render
    case @format
    when 'apa'     then apa
    when 'chicago' then chicago
    when 'mla'     then mla
    when 'bibtex'  then bibtex
    when 'ris'     then ris
    end
  end

  private

  # ---- Author helpers ----

  def authors
    return @source.ordered_authors.to_a if @source.respond_to?(:ordered_authors) && @source.ordered_authors.any?
    str = @source.authors_string
    return [] if str.blank?
    str.split(/[,;]/).map(&:strip).reject(&:blank?).map { |n| OpenStruct.new(full_name: n, first_name: nil, last_name: n) }
  rescue
    []
  end

  def apa_authors
    list = authors
    return '' if list.empty?
    formatted = list.map do |a|
      name = a.respond_to?(:full_name) ? a.full_name.to_s : a.to_s
      apa_name(name)
    end
    join_with_amp(formatted)
  end

  # "Last, F. M."
  def apa_name(full)
    return full if full.blank?
    parts = full.strip.split(/\s+/)
    return full if parts.size == 1
    last = parts.pop
    initials = parts.map { |p| "#{p[0]}." }.join(' ')
    "#{last}, #{initials}"
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
    names = list.map(&:full_name)
    case names.size
    when 1
      mla_invert(names.first)
    when 2
      "#{mla_invert(names.first)}, and #{names.last}"
    else
      "#{mla_invert(names.first)}, et al."
    end
  end

  def mla_invert(full)
    parts = full.to_s.strip.split(/\s+/)
    return full if parts.size < 2
    last = parts.pop
    "#{last}, #{parts.join(' ')}"
  end

  def chicago_authors
    list = authors
    return '' if list.empty?
    names = list.map(&:full_name)
    case names.size
    when 1 then mla_invert(names.first)
    when 2 then "#{mla_invert(names.first)}, and #{names.last}"
    else
      formatted = [mla_invert(names.first)] + names[1..].map { |n| n }
      formatted[0..-2].join(', ') + ', and ' + formatted.last
    end
  end

  def bibtex_authors
    list = authors
    list.map(&:full_name).join(' and ')
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
    last = authors.first&.full_name&.split&.last || 'source'
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
    authors.each { |a| lines << "AU  - #{a.full_name}" }
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
