class AddCacheColumnsToConceptDefinitions < ActiveRecord::Migration[7.1]
  def up
    add_column :concept_definitions, :slug, :string
    add_column :concept_definitions, :rejection_count, :integer, default: 0, null: false
    add_column :concept_definitions, :linked_count_cache, :integer, default: 0, null: false

    add_column :concepts, :definition_acquired_via, :string

    say_with_time "Backfilling concept_definitions.slug from label" do
      execute(<<~SQL)
        UPDATE concept_definitions
        SET slug = lower(regexp_replace(trim(label), '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL
      SQL
    end

    say_with_time "Backfilling concept_definitions.linked_count_cache" do
      execute(<<~SQL)
        UPDATE concept_definitions cd
        SET linked_count_cache = sub.cnt
        FROM (
          SELECT definition_id, COUNT(*) AS cnt
          FROM concepts
          WHERE definition_id IS NOT NULL
          GROUP BY definition_id
        ) sub
        WHERE cd.id = sub.definition_id
      SQL
    end

    add_index :concept_definitions, [:slug, :concept_type]
  end

  def down
    remove_index :concept_definitions, [:slug, :concept_type]
    remove_column :concepts, :definition_acquired_via
    remove_column :concept_definitions, :linked_count_cache
    remove_column :concept_definitions, :rejection_count
    remove_column :concept_definitions, :slug
  end
end
