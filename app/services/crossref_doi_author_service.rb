require 'net/http'
require 'uri'
require 'json'

# Fetches a paper's author list (name + ORCID where available) from Crossref.
# Free, no auth. Used to disambiguate existing Person records by finding their
# ORCID across multiple papers they're known to have authored.
class CrossrefDoiAuthorService
  BASE_URL = 'https://api.crossref.org/works'
  USER_AGENT = 'TDL-2025 (research tracking; mailto:support@example.com)'

  def initialize(doi)
    @doi = normalize(doi)
  end

  # Returns [{ family:, given:, orcid: }, ...] or [] if the DOI isn't found / request fails.
  def authors
    return [] if @doi.blank?

    data = get("/#{URI.encode_www_form_component(@doi)}")
    return [] unless data

    message = data['message'] || {}
    Array(message['author']).map do |a|
      {
        family: a['family'],
        given: a['given'],
        orcid: normalize_orcid(a['ORCID'])
      }
    end
  end

  private

  def normalize(doi)
    return nil if doi.blank?
    doi.to_s.strip.sub(%r{^https?://(dx\.)?doi\.org/}i, '')
  end

  def normalize_orcid(orcid)
    return nil if orcid.blank?
    bare = orcid.to_s.strip.sub(%r{^https?://}, '').sub(%r{^orcid\.org/}, '')
    bare.match?(/\A\d{4}-\d{4}-\d{4}-\d{3}[\dX]\z/i) ? bare.upcase : nil
  end

  def get(path)
    uri = URI("#{BASE_URL}#{path}")
    req = Net::HTTP::Get.new(uri)
    req['Accept'] = 'application/json'
    req['User-Agent'] = USER_AGENT

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 10

    res = http.request(req)
    return nil unless res.is_a?(Net::HTTPSuccess)

    JSON.parse(res.body)
  rescue => e
    Rails.logger.warn "Crossref fetch failed for #{@doi}: #{e.class} - #{e.message}"
    nil
  end
end
