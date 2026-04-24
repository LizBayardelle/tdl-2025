require 'net/http'
require 'uri'
require 'json'

# STUB — not yet wired into the enrichment pipeline.
#
# When implemented, this service will fetch a researcher's OpenAlex profile and
# return data that ORCID doesn't expose well:
#
#   - current affiliation (often fresher than ORCID's employment history)
#   - concept tags (research areas, useful for auto-linking to the Concepts table)
#   - h-index / works_count / cited_by_count
#   - canonical OpenAlex profile URL (for `links[]`)
#   - a list of recent works (useful for "people who wrote these papers you don't have yet")
#
# Lookup strategy:
#   1. If person has an ORCID: hit `api.openalex.org/authors/orcid:{orcid}` — deterministic.
#   2. Otherwise: search by name + known work titles, use multi-paper consensus
#      (same pattern as BackfillPersonOrcidJob) to pick a canonical OpenAlex Author ID.
#
# See https://docs.openalex.org/api-entities/authors for the shape of the response.
class OpenalexEnrichmentService
  BASE_URL = 'https://api.openalex.org'
  USER_AGENT = 'TDL-2025 (research tracking; mailto:support@example.com)'

  def initialize(person)
    @person = person
  end

  # Returns { openalex_id:, affiliation:, concepts: [...], h_index:, works_count:,
  #           cited_by_count:, openalex_url: } or nil.
  def fetch
    # TODO: implement. See class docs for strategy.
    nil
  end

  private

  def fetch_by_orcid(orcid)
    # TODO: GET #{BASE_URL}/authors/orcid:#{orcid}
    nil
  end

  def disambiguate_by_works(name, known_titles)
    # TODO: for each title, GET #{BASE_URL}/works?search=<title>, find matching
    # author in the work's authorships, collect OpenAlex author IDs, pick by
    # multi-paper consensus (mirrors BackfillPersonOrcidJob#pick_orcid).
    nil
  end
end
