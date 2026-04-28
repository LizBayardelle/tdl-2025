require 'net/http'
require 'uri'
require 'json'

# Fetches a researcher's public profile from the ORCID Public API.
# Free, no auth required, only returns fields the researcher has marked public.
# Docs: https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/
class OrcidEnrichmentService
  BASE_URL = 'https://pub.orcid.org/v3.0'
  USER_AGENT = 'TDL-2025 (research tracking; contact via app)'

  def initialize(orcid)
    @orcid = normalize(orcid)
  end

  # Returns a hash { email:, biography:, homepage:, affiliation:, links: [...], external_ids: [...] }
  # or nil on failure.  Any field may be missing if the researcher hasn't made it public.
  # `external_ids` are entries like Scopus Author ID, ResearcherID, ISNI, Loop, etc.,
  # each shaped like { 'label' => 'Scopus Author ID', 'url' => '...' }.  Only entries
  # that include a canonical URL are returned — typed identifiers without a URL aren't
  # actionable in the UI.
  def fetch
    return nil if @orcid.blank?

    record = get("/#{@orcid}/record")
    return nil unless record

    person = record['person'] || {}
    activities = record['activities-summary'] || {}

    {
      orcid: @orcid,
      email: first_public_email(person),
      biography: person.dig('biography', 'content'),
      homepage: first_researcher_url(person),
      affiliation: current_affiliation(activities),
      links: researcher_urls(person),
      external_ids: external_ids(person)
    }
  end

  private

  def normalize(orcid)
    return nil if orcid.blank?
    orcid.to_s.strip.sub(%r{^https?://}, '').sub(%r{^orcid\.org/}, '').upcase
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
    Rails.logger.warn "ORCID fetch failed for #{@orcid}: #{e.class} - #{e.message}"
    nil
  end

  def first_public_email(person)
    emails = person.dig('emails', 'email') || []
    primary = emails.find { |e| e['primary'] } || emails.first
    primary&.dig('email')
  end

  def first_researcher_url(person)
    urls = person.dig('researcher-urls', 'researcher-url') || []
    urls.first&.dig('url', 'value')
  end

  def researcher_urls(person)
    urls = person.dig('researcher-urls', 'researcher-url') || []
    urls.map do |u|
      label = u['url-name'].presence || 'Link'
      url = u.dig('url', 'value')
      next nil unless url
      { 'label' => label, 'url' => url }
    end.compact
  end

  # External IDs ORCID tracks — Scopus Author ID, ResearcherID, ISNI, Loop,
  # GitHub, etc.  Each entry has a type, value, and (usually) a canonical URL.
  # We keep only the URL-bearing ones so they fit cleanly into the Person.links
  # array as labeled clickable chips.
  def external_ids(person)
    entries = person.dig('external-identifiers', 'external-identifier') || []
    entries.map do |e|
      label = e['external-id-type'].to_s.strip
      url = e.dig('external-id-url', 'value')
      next nil if url.blank? || label.blank?
      { 'label' => label, 'url' => url }
    end.compact
  end

  def current_affiliation(activities)
    groups = activities.dig('employments', 'affiliation-group') || []
    # Most recent employment — ORCID returns them in reverse chronological order.
    group = groups.first
    return nil unless group
    summary = group.dig('summaries', 0, 'employment-summary')
    return nil unless summary
    [
      summary.dig('role-title'),
      summary.dig('organization', 'name')
    ].compact.reject(&:blank?).join(', ')
  end
end
