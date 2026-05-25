class CreateCollectionGroupings < ActiveRecord::Migration[7.2]
  # Replaces the fixed-string `tier` column on collection_items with a
  # per-collection groupings list. Each collection owns its own ordered set
  # of groupings; a source belongs to at most one. Deleting a grouping
  # nullifies the link so the sources fall back to "Unsorted".
  DEFAULT_GROUPINGS = %w[Core Important Supporting Background Methodology].freeze

  # Maps the historical fixed-tier strings to their default-grouping names so
  # we can backfill existing data without losing anyone's curation.
  LEGACY_TIER_TO_NAME = {
    'core'        => 'Core',
    'important'   => 'Important',
    'supporting'  => 'Supporting',
    'background'  => 'Background',
    'methodology' => 'Methodology'
  }.freeze

  def up
    create_table :collection_groupings do |t|
      t.references :collection, null: false, foreign_key: true, index: true
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :collection_groupings, [:collection_id, :position]
    add_index :collection_groupings, [:collection_id, :name], unique: true

    add_reference :collection_items, :grouping,
      foreign_key: { to_table: :collection_groupings, on_delete: :nullify },
      index: true

    # Seed every existing collection with the default groupings. Cheap and
    # makes the feature immediately usable; users can rename or delete from
    # there. Done with raw SQL since the model file may or may not exist yet
    # at the time the migration runs in fresh setups.
    now = Time.current
    execute("SELECT id FROM collections").each do |row|
      collection_id = row['id']
      DEFAULT_GROUPINGS.each_with_index do |name, idx|
        quoted_name = ActiveRecord::Base.connection.quote(name)
        execute(<<~SQL)
          INSERT INTO collection_groupings (collection_id, name, position, created_at, updated_at)
          VALUES (#{collection_id}, #{quoted_name}, #{idx}, '#{now.iso8601}', '#{now.iso8601}')
        SQL
      end
    end

    # Remap existing tier strings to the new grouping rows, scoped per
    # collection so the FK lines up.
    LEGACY_TIER_TO_NAME.each do |legacy, name|
      quoted_name = ActiveRecord::Base.connection.quote(name)
      quoted_legacy = ActiveRecord::Base.connection.quote(legacy)
      execute(<<~SQL)
        UPDATE collection_items
        SET grouping_id = cg.id
        FROM collection_groupings cg
        WHERE collection_items.collection_id = cg.collection_id
          AND cg.name = #{quoted_name}
          AND collection_items.tier = #{quoted_legacy}
      SQL
    end

    remove_index :collection_items, [:collection_id, :tier]
    remove_column :collection_items, :tier
  end

  def down
    add_column :collection_items, :tier, :string
    add_index  :collection_items, [:collection_id, :tier]

    LEGACY_TIER_TO_NAME.each do |legacy, name|
      quoted_name = ActiveRecord::Base.connection.quote(name)
      quoted_legacy = ActiveRecord::Base.connection.quote(legacy)
      execute(<<~SQL)
        UPDATE collection_items
        SET tier = #{quoted_legacy}
        FROM collection_groupings cg
        WHERE collection_items.grouping_id = cg.id
          AND cg.name = #{quoted_name}
      SQL
    end

    remove_reference :collection_items, :grouping, foreign_key: { to_table: :collection_groupings }
    drop_table :collection_groupings
  end
end
