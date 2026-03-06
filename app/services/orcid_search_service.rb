require 'net/http'
require 'json'

class OrcidSearchService
  ORCID_API_URL = 'https://pub.orcid.org/v3.0'

  def initialize(family_name:, given_name: nil, doi: nil)
    @family_name = family_name
    @given_name = given_name
    @doi = doi&.downcase&.strip
  end

  def search
    return [] if @family_name.blank?

    query = build_query
    Rails.logger.info "ORCID search query: #{query}, DOI filter: #{@doi || 'none'}"

    uri = URI("#{ORCID_API_URL}/search/?q=#{CGI.escape(query)}&rows=10")

    request = Net::HTTP::Get.new(uri)
    request['Accept'] = 'application/json'

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 15

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      results = data.dig('result') || []

      # Fetch details for each ORCID, checking for DOI match
      profiles = results.map do |result|
        orcid_id = result.dig('orcid-identifier', 'path')
        fetch_profile_with_doi_check(orcid_id, http)
      end.compact

      # If we have a DOI, prioritize verified matches
      if @doi.present?
        verified = profiles.select { |p| p[:doi_verified] }
        unverified = profiles.reject { |p| p[:doi_verified] }

        # If we found verified matches, only return those
        if verified.any?
          Rails.logger.info "Found #{verified.length} ORCID profiles with DOI match"
          return verified.first(5)
        else
          # No verified matches - return unverified but mark them
          Rails.logger.info "No ORCID profiles with DOI match, returning #{unverified.length} unverified"
          return unverified.first(5)
        end
      else
        profiles.first(5)
      end
    else
      Rails.logger.warn "ORCID search failed: #{response.code}"
      []
    end
  rescue => e
    Rails.logger.error "ORCID search error: #{e.message}"
    []
  end

  private

  def build_query
    parts = ["family-name:#{@family_name}"]

    if @given_name.present?
      # If it's just an initial (single letter), use wildcard
      if @given_name.gsub('.', '').length == 1
        parts << "given-names:#{@given_name.gsub('.', '')}*"
      else
        parts << "given-names:#{@given_name}"
      end
    end

    parts.join(' AND ')
  end

  def fetch_profile_with_doi_check(orcid_id, http)
    return nil if orcid_id.blank?

    # Fetch person data
    uri = URI("#{ORCID_API_URL}/#{orcid_id}/person")
    request = Net::HTTP::Get.new(uri)
    request['Accept'] = 'application/json'

    response = http.request(request)
    return nil unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    name_data = data.dig('name')
    given_name = name_data&.dig('given-names', 'value')
    family_name = name_data&.dig('family-name', 'value')

    # Check if this ORCID has the article (if DOI provided)
    doi_verified = false
    if @doi.present?
      doi_verified = check_works_for_doi(orcid_id, http)
    end

    # Fetch affiliations
    affiliations = fetch_affiliations(orcid_id, http)

    {
      orcid: orcid_id,
      given_name: given_name,
      family_name: family_name,
      full_name: [given_name, family_name].compact.join(' '),
      affiliations: affiliations,
      doi_verified: doi_verified
    }
  rescue => e
    Rails.logger.error "ORCID profile fetch error for #{orcid_id}: #{e.message}"
    nil
  end

  def check_works_for_doi(orcid_id, http)
    uri = URI("#{ORCID_API_URL}/#{orcid_id}/works")
    request = Net::HTTP::Get.new(uri)
    request['Accept'] = 'application/json'

    response = http.request(request)
    return false unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    groups = data.dig('group') || []

    # Check each work group for matching DOI
    groups.each do |group|
      external_ids = group.dig('external-ids', 'external-id') || []
      external_ids.each do |ext_id|
        if ext_id['external-id-type'] == 'doi'
          work_doi = ext_id['external-id-value']&.downcase&.strip
          # Normalize DOIs for comparison (remove https://doi.org/ prefix if present)
          work_doi = work_doi.sub(%r{^https?://doi\.org/}, '') if work_doi
          target_doi = @doi.sub(%r{^https?://doi\.org/}, '')

          if work_doi == target_doi
            Rails.logger.info "DOI match found for ORCID #{orcid_id}"
            return true
          end
        end
      end
    end

    false
  rescue => e
    Rails.logger.error "ORCID works check error for #{orcid_id}: #{e.message}"
    false
  end

  def fetch_affiliations(orcid_id, http)
    affiliations = []

    uri = URI("#{ORCID_API_URL}/#{orcid_id}/employments")
    request = Net::HTTP::Get.new(uri)
    request['Accept'] = 'application/json'

    response = http.request(request)
    return affiliations unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    employment_groups = data.dig('affiliation-group') || []

    employment_groups.each do |group|
      summaries = group.dig('summaries') || []
      summaries.each do |summary|
        emp = summary.dig('employment-summary')
        if emp
          org_name = emp.dig('organization', 'name')
          affiliations << org_name if org_name.present?
        end
      end
    end

    affiliations.uniq.first(3)
  rescue => e
    Rails.logger.error "ORCID affiliations fetch error for #{orcid_id}: #{e.message}"
    []
  end
end
