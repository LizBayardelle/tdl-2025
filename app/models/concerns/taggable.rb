module Taggable
  extend ActiveSupport::Concern

  included do
    has_many :taggings, as: :taggable, dependent: :destroy
    has_many :tags, through: :taggings

    # Scope to find records with a specific tag
    scope :tagged_with, ->(tag_name) {
      joins(:tags).where(tags: { name: tag_name })
    }
  end

  # Set tags from an array of tag names
  def tag_list=(names)
    return if names.blank?

    names = names.split(',').map(&:strip) if names.is_a?(String)

    transaction do
      # Remove all existing taggings
      taggings.destroy_all

      # Create new taggings
      names.each do |name|
        next if name.blank?
        tag = user.tags.find_or_create_by!(name: name) do |t|
          t.slug = name.parameterize
        end
        tags << tag unless tags.include?(tag)
      end
    end
  end

  # Get tag names as comma-separated string
  def tag_list
    tags.pluck(:name).join(', ')
  end
end
