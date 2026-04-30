# Create a Source record from an approved batch upload item
class CreateSourceFromUploadJob < ApplicationJob
  queue_as :default

  def perform(item_id)
    item = UploadBatchItem.find_by(id: item_id)
    return unless item
    return unless item.status_approved?

    Rails.logger.info "Creating source from batch upload item #{item_id}"

    begin
      decisions = item.user_decisions
      user = item.user

      # Merge extracted metadata with any user edits from decisions
      metadata = item.extracted_metadata.merge(decisions['metadata'] || {})

      # Build source attributes
      # Note: Don't include 'authors' here - it conflicts with the has_many :authors association
      # Author linking is handled separately by link_authors method
      doi = metadata['doi'] || item.extracted_doi

      # Check if source with this DOI already exists
      existing_source = doi.present? ? user.sources.find_by(doi: doi) : nil

      if existing_source
        # Link to existing source instead of creating duplicate
        Rails.logger.info "Source with DOI #{doi} already exists (ID: #{existing_source.id}), linking instead of creating"
        source = existing_source
      else
        # Paywall: refuse to create new sources past the free tier limit + grace.
        unless user.can_create_source?
          Rails.logger.info "Skipping source creation for upload item #{item_id}: user #{user.id} past free tier (#{User::FREE_SOURCE_LIMIT} articles)"
          item.update!(
            status: :failed,
            error_message: "Past the free tier limit of #{User::FREE_SOURCE_LIMIT} articles.  Subscribe to Pro to keep importing."
          )
          return
        end

        source_attrs = {
          title: metadata['title'],
          year: metadata['year'],
          kind: metadata['kind'] || 'article',
          doi: doi,
          url: metadata['url'],
          abstract: metadata['abstract'],
          journal_name: metadata['journal_name'],
          volume: metadata['volume'],
          issue: metadata['issue'],
          pages: metadata['pages'],
          publisher_or_venue: metadata['publisher_or_venue']
        }

        # Create the source
        source = user.sources.create!(source_attrs.compact)
      end

      # Attach PDF
      if item.pdf.attached?
        source.pdf.attach(item.pdf.blob)
      end

      # Set keywords
      if metadata['keywords'].present?
        source[:keywords] = metadata['keywords']
        source.save!
      end

      # Link authors/people
      link_authors(source, item, user, decisions)

      # Link concepts (from item.detected_concepts — the bulk pipeline
      # already ran ConceptSuggestionService during processing).
      link_concepts(source, item, user, decisions)

      # Run universal enrichment: research-type + stat-test tagging.
      # Concept suggestion is gated on source.concepts.empty?, so the
      # link_concepts step above takes precedence for bulk uploads.
      EnrichSourceJob.perform_later(source.id)

      # Update item with created source
      item.update!(
        status: :created,
        source_id: source.id
      )

      Rails.logger.info "Successfully created source #{source.id} from item #{item_id}"
    rescue => e
      Rails.logger.error "Failed to create source from item #{item_id}: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      item.mark_failed!("Failed to create source: #{e.message}")
    end
  end

  private

  def link_authors(source, item, user, decisions)
    detected_authors = item.detected_authors
    author_decisions = decisions['authors'] || {}

    detected_authors.each_with_index do |author, idx|
      # Check if user made a decision for this author
      decision = author_decisions[idx.to_s] || author_decisions[idx]

      if decision
        # User made explicit decision
        case decision['action']
        when 'link'
          person = user.people.find_by(id: decision['person_id'])
          source.people << person if person && !source.people.include?(person)
        when 'create'
          person = create_person(user, author, decision)
          source.people << person if person
        when 'skip'
          # Do nothing
        end
      elsif author['auto_linked'] && author['linked_person_id']
        # Auto-linked author
        person = user.people.find_by(id: author['linked_person_id'])
        source.people << person if person && !source.people.include?(person)
      else
        # Create new person
        person = create_person(user, author, nil)
        source.people << person if person
      end
    end

    # Manually-added extras (authors not in the detected list)
    Array(decisions['extra_authors']).each do |extra|
      last_name = extra['last_name'].presence
      first_name = extra['first_name'].presence
      next if last_name.blank? && first_name.blank?

      begin
        person = user.people.create!(
          first_name: first_name,
          last_name: last_name || first_name,
          orcid: extra['orcid'].presence,
          role: 'researcher'
        )
        source.people << person unless source.people.include?(person)
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.warn "Failed to create extra person: #{e.message}"
      end
    end

    # Update authors string column from linked people
    # Note: Must use write_attribute because 'authors' is both a column and an association name
    if source.people.any?
      source.write_attribute(:authors, source.people.map(&:full_name).join(', '))
      source.save!
    end
  end

  def create_person(user, author, decision)
    first_name = decision&.dig('first_name') || author['given']
    last_name = decision&.dig('last_name') || author['family']
    orcid = decision&.dig('orcid') || author['orcid']

    return nil if last_name.blank?

    user.people.create!(
      first_name: first_name,
      last_name: last_name,
      orcid: orcid.presence,
      role: 'researcher'
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "Failed to create person: #{e.message}"
    nil
  end

  def link_concepts(source, item, user, decisions)
    detected_concepts = item.detected_concepts
    concept_decisions = decisions['concepts'] || {}

    concept_ids_to_link = []

    detected_concepts.each_with_index do |concept, idx|
      decision = concept_decisions[idx.to_s] || concept_decisions[idx]

      if decision
        case decision['action']
        when 'link'
          concept_ids_to_link << decision['concept_id']
        when 'create'
          new_concept = user.concepts.create!(
            label: decision['label'] || concept['keyword'],
            concept_type: decision['concept_type'] || decision['node_type']
          )
          concept_ids_to_link << new_concept.id
        when 'skip'
          # Do nothing
        end
      elsif concept['auto_linked'] && concept['matched_concept_id']
        concept_ids_to_link << concept['matched_concept_id']
      else
        # Auto-resolve fallback (no user decision, no auto-link).  Used by
        # the bulk-upload "auto-approve" path so concepts that came back
        # from extraction get created instead of silently dropped.  Both
        # sources here are already filtered: raw keywords passed through
        # valid_concept_keyword? in the process job; LLM suggestions are
        # vetted by the model.  Find-or-create is safe.
        label = concept['keyword'].to_s.strip
        next if label.blank?

        concept_type = concept['suggested_type'].presence || 'non_physical_concept'
        existing = user.concepts.find_by('LOWER(label) = LOWER(?)', label)
        new_concept = existing || begin
          user.concepts.create!(label: label, concept_type: concept_type)
        rescue ActiveRecord::RecordInvalid => e
          Rails.logger.warn "Auto-create concept failed for #{label}: #{e.message}"
          nil
        end
        concept_ids_to_link << new_concept.id if new_concept
      end
    end

    # Also add any explicitly selected concepts from decisions
    if decisions['selected_concept_ids'].present?
      concept_ids_to_link += decisions['selected_concept_ids']
    end

    # Manually-added extras (concepts not in the detected list)
    Array(decisions['extra_concepts']).each do |extra|
      label = extra['label'].to_s.strip
      next if label.blank?

      begin
        existing = user.concepts.find_by('LOWER(label) = LOWER(?)', label)
        new_concept = existing || user.concepts.create!(
          label: label,
          concept_type: extra['concept_type'].presence || 'non_physical_concept'
        )
        concept_ids_to_link << new_concept.id
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.warn "Failed to create extra concept: #{e.message}"
      end
    end

    # Link all concepts
    concept_ids_to_link.uniq.each do |concept_id|
      concept = user.concepts.find_by(id: concept_id)
      source.concepts << concept if concept && !source.concepts.include?(concept)
    end
  end
end
