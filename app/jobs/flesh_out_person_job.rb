# Fills in a Person's email, links, and bio from their public ORCID record.
# Only fills fields the user hasn't already populated — never clobbers manual edits.
class FleshOutPersonJob < ApplicationJob
  queue_as :default

  def perform(person_id)
    person = Person.find_by(id: person_id)
    return unless person
    return unless person.orcid.present?

    data = OrcidEnrichmentService.new(person.orcid).fetch
    unless data
      Rails.logger.info "ORCID returned no data for person #{person_id} (#{person.orcid})"
      person.update_column(:enriched_at, Time.current) if person.respond_to?(:enriched_at)
      return
    end

    updates = {}
    updates[:email] = data[:email] if person.email.blank? && data[:email].present?
    updates[:summary] = data[:biography] if person.summary.blank? && data[:biography].present?
    updates[:url] = data[:homepage] if person.url.blank? && data[:homepage].present?

    merged_links = merge_links(person.links || [], data[:links] || [])
    updates[:links] = merged_links if merged_links != (person.links || [])

    updates[:enriched_at] = Time.current

    person.update!(updates)
    Rails.logger.info "Enriched person #{person_id} from ORCID: #{updates.keys.join(', ')}"

    # TODO: follow-up enrichment pass — call OpenalexEnrichmentService(person).fetch
    # to pick up affiliation, concept tags, h-index, and OpenAlex profile URL.
    # Stubbed in app/services/openalex_enrichment_service.rb.
  end

  private

  # Append new links, dedup by URL (case-insensitive).
  def merge_links(existing, incoming)
    seen = existing.map { |l| l['url'].to_s.downcase }.to_set
    additions = incoming.reject { |l| seen.include?(l['url'].to_s.downcase) }
    existing + additions
  end
end
