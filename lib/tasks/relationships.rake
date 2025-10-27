namespace :relationships do
  desc "Clean up duplicate inverse relationships in the database"
  task cleanup_duplicates: :environment do
    puts "Starting cleanup of duplicate inverse relationships..."

    cleaned_count = 0
    kept_count = 0

    Connection.find_each do |connection|
      # Skip if already deleted
      next unless connection.persisted?

      rel_type = connection.rel_type
      inverse_type = Connection::INVERSE_PAIRS[rel_type]

      # Skip if this relationship type doesn't have an inverse
      next unless inverse_type

      # Check if the inverse relationship exists
      inverse = Connection.find_by(
        src_concept_id: connection.dst_concept_id,
        dst_concept_id: connection.src_concept_id,
        rel_type: inverse_type
      )

      if inverse
        # We found a duplicate inverse pair
        # Keep the canonical one, delete the non-canonical one
        if Connection::CANONICAL_RELATIONSHIPS.include?(connection.rel_type)
          # This is canonical, delete the inverse
          puts "  Deleting non-canonical: #{inverse.src_concept.label} #{inverse.rel_type} #{inverse.dst_concept.label}"
          puts "  Keeping canonical:      #{connection.src_concept.label} #{connection.rel_type} #{connection.dst_concept.label}"
          inverse.destroy
          cleaned_count += 1
          kept_count += 1
        else
          # This is non-canonical, it will be deleted when we process the canonical one
          # Do nothing here to avoid double-counting
        end
      end
    end

    puts "\nCleanup complete!"
    puts "Removed: #{cleaned_count} duplicate relationships"
    puts "Kept: #{kept_count} canonical relationships"
  end

  desc "Convert all non-canonical relationships to canonical form"
  task normalize_all: :environment do
    puts "Normalizing all relationships to canonical form..."

    normalized_count = 0

    Connection.find_each do |connection|
      # Check if this needs normalization
      if Connection::INVERSE_PAIRS.key?(connection.rel_type) &&
         !Connection::CANONICAL_RELATIONSHIPS.include?(connection.rel_type)

        # This is a non-canonical relationship, normalize it
        normalized = Connection.normalize_relationship_params(
          connection.src_concept_id,
          connection.dst_concept_id,
          connection.rel_type
        )

        puts "  Converting: #{connection.src_concept.label} #{connection.rel_type} #{connection.dst_concept.label}"
        puts "  To:         #{Concept.find(normalized[:src_concept_id]).label} #{normalized[:rel_type]} #{Concept.find(normalized[:dst_concept_id]).label}"

        connection.update_columns(normalized)
        normalized_count += 1
      end
    end

    puts "\nNormalization complete!"
    puts "Converted: #{normalized_count} relationships to canonical form"
  end

  desc "Full cleanup: normalize then remove duplicates"
  task full_cleanup: :environment do
    puts "=" * 60
    puts "FULL RELATIONSHIP CLEANUP"
    puts "=" * 60
    puts ""

    # First normalize all relationships
    Rake::Task['relationships:normalize_all'].invoke

    puts ""
    puts "-" * 60
    puts ""

    # Then remove duplicates
    Rake::Task['relationships:cleanup_duplicates'].invoke

    puts ""
    puts "=" * 60
    puts "Full cleanup complete!"
    puts "=" * 60
  end
end
