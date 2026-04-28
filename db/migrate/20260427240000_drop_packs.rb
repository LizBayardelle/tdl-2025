# Removes the pack feature.  Packs were the original consumer monetization
# (one-time purchase of curated concept-definition bundles); replaced by
# the three-tier subscription + on-demand concept-definition generation.
#
# This migration is destructive — paid pack purchases on staging/prod
# should be refunded out-of-band before running it (see Refund Policy).
# After this runs there is no path back to the consumer pack flow without
# rebuilding from scratch.
class DropPacks < ActiveRecord::Migration[7.2]
  def up
    # Drop the FK + columns on concept_definitions first so we can drop
    # packs.  pack_id is nullable, pack_version is unindexed text.
    if foreign_key_exists?(:concept_definitions, :packs)
      remove_foreign_key :concept_definitions, :packs
    end
    remove_index :concept_definitions, :pack_id if index_exists?(:concept_definitions, :pack_id)
    remove_column :concept_definitions, :pack_id     if column_exists?(:concept_definitions, :pack_id)
    remove_column :concept_definitions, :pack_version if column_exists?(:concept_definitions, :pack_version)

    drop_table :user_packs if table_exists?(:user_packs)
    drop_table :packs      if table_exists?(:packs)
  end

  def down
    # Intentional one-way migration.  Packs are not coming back; if a
    # future B2B bundle product needs a similar shape, build it fresh
    # rather than restoring this schema.
    raise ActiveRecord::IrreversibleMigration
  end
end
