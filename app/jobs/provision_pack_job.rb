class ProvisionPackJob < ApplicationJob
  queue_as :default

  def perform(user_id, pack_id)
    user = User.find(user_id)
    pack = Pack.find(pack_id)

    # Create or update the user_pack record
    user_pack = UserPack.find_or_initialize_by(user: user, pack: pack)
    user_pack.purchased_at ||= Time.current
    user_pack.save!

    # Create concepts for each definition in the pack
    pack.concept_definitions.find_each do |definition|
      create_or_link_concept(user, definition)
    end
  end

  private

  def create_or_link_concept(user, definition)
    # Try to find an existing concept by label (case-insensitive)
    existing = user.concepts.find_by("LOWER(label) = ?", definition.label.downcase)

    concept = if existing
      # Link existing concept to this definition (don't duplicate)
      existing.update!(definition: definition) unless existing.definition_id
      existing
    else
      # Create a new concept linked to the definition
      user.concepts.create!(
        label: definition.label,
        slug: generate_unique_slug(user, definition.label),
        definition: definition,
        concept_type: definition.concept_type
      )
    end

    # Copy links from definition to concept
    copy_links(definition, concept)
  end

  def copy_links(definition, concept)
    definition.links.find_each do |link|
      # Only add if concept doesn't already have this link
      unless concept.links.exists?(id: link.id)
        concept.linkings.find_or_create_by!(link: link)
      end
    end
  end

  def generate_unique_slug(user, label)
    base_slug = label.parameterize
    slug = base_slug
    counter = 1

    while user.concepts.exists?(slug: slug)
      slug = "#{base_slug}-#{counter}"
      counter += 1
    end

    slug
  end
end
