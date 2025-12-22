class CleanHtmlFromSourceAbstracts < ActiveRecord::Migration[7.2]
  def up
    # Clean HTML/XML tags from existing abstracts and summaries
    Source.find_each do |source|
      changed = false

      if source.abstract.present? && source.abstract.match?(/<[^>]+>/)
        source.abstract = strip_html_tags(source.abstract)
        changed = true
      end

      if source.summary.present? && source.summary.match?(/<[^>]+>/)
        source.summary = strip_html_tags(source.summary)
        changed = true
      end

      source.save(validate: false) if changed
    end
  end

  def down
    # No reversal - we can't restore the HTML tags
  end

  private

  def strip_html_tags(text)
    return nil if text.nil?
    # Strip HTML/XML tags and decode HTML entities
    text = text.gsub(/<[^>]+>/, ' ')  # Replace tags with space
    text = text.gsub(/\s+/, ' ')      # Collapse multiple spaces
    text = text.strip                  # Remove leading/trailing whitespace
    # Decode common HTML entities
    text = text.gsub('&lt;', '<')
    text = text.gsub('&gt;', '>')
    text = text.gsub('&amp;', '&')
    text = text.gsub('&quot;', '"')
    text = text.gsub("&apos;", "'")
    text
  end
end
