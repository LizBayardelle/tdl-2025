# Attempts to find a Person's ORCID by looking at the papers they've authored.
# For each of the Person's DOI-bearing Sources, hits Crossref, finds the author
# whose name matches, and collects ORCID candidates. If the same ORCID appears
# across 2+ papers (or is the only unambiguous candidate), assigns it and then
# triggers the existing FleshOutPersonJob to pull the full public profile.
class BackfillPersonOrcidJob < ApplicationJob
  queue_as :default

  # Minimum number of papers an ORCID must appear in to auto-assign, unless it's
  # the only candidate across ALL the person's papers.
  CONSENSUS_THRESHOLD = 2

  def perform(person_id)
    person = Person.find_by(id: person_id)
    return unless person
    return if person.orcid.present? # already have one — nothing to backfill

    dois = person.sources.where.not(doi: [nil, '']).pluck(:doi).uniq
    if dois.empty?
      Rails.logger.info "BackfillPersonOrcid: person #{person_id} has no DOI'd sources, skipping"
      return
    end

    orcid_counts = Hash.new(0)
    papers_inspected = 0

    dois.each do |doi|
      authors = CrossrefDoiAuthorService.new(doi).authors
      next if authors.empty?

      papers_inspected += 1
      matches = find_name_matches(authors, person)
      # Only count unambiguous name matches — if 2+ authors on one paper match
      # this person's name, the paper can't disambiguate and we skip it.
      next unless matches.size == 1

      orcid = matches.first[:orcid]
      orcid_counts[orcid] += 1 if orcid
    end

    if papers_inspected.zero?
      Rails.logger.info "BackfillPersonOrcid: no Crossref data for any of person #{person_id}'s #{dois.size} DOIs"
      return
    end

    chosen = pick_orcid(orcid_counts, papers_inspected)
    unless chosen
      Rails.logger.info "BackfillPersonOrcid: person #{person_id} — no confident ORCID (counts: #{orcid_counts.inspect}, papers: #{papers_inspected})"
      return
    end

    person.update!(orcid: chosen)
    Rails.logger.info "BackfillPersonOrcid: assigned #{chosen} to person #{person_id} (#{orcid_counts[chosen]}/#{papers_inspected} papers)"

    # Chain into full profile enrichment now that we have an ORCID.
    FleshOutPersonJob.perform_later(person.id)
  end

  private

  # Find authors in a paper whose family name matches the person's last_name,
  # narrowing further by first-initial if multiple last-name matches.
  def find_name_matches(authors, person)
    last = (person.last_name || extract_last(person.full_name)).to_s.downcase.strip
    first = (person.first_name || extract_first(person.full_name)).to_s.downcase.strip
    return [] if last.blank?

    family_matches = authors.select { |a| a[:family].to_s.downcase.strip == last }
    return family_matches if family_matches.size <= 1 || first.blank?

    # Multiple authors with same last name on this paper — filter by first initial.
    initial = first[0]
    family_matches.select { |a| a[:given].to_s.downcase.strip.start_with?(initial) }
  end

  def extract_last(full_name)
    full_name.to_s.split(/\s+/).last
  end

  def extract_first(full_name)
    full_name.to_s.split(/\s+/).first
  end

  # Pick the ORCID with the most support, if it clears the consensus threshold.
  # Falls back to "only candidate across all papers" if there's just one.
  def pick_orcid(counts, papers_inspected)
    return nil if counts.empty?

    top_orcid, top_count = counts.max_by { |_, n| n }
    return top_orcid if top_count >= CONSENSUS_THRESHOLD
    return top_orcid if counts.size == 1 && papers_inspected >= 1 && top_count == papers_inspected
    nil
  end
end
