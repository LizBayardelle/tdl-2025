# Folds prerequisite_for into builds_on for the relationship-taxonomy refresh.
# Semantic equivalence: "A prerequisite_for B" ≡ "B builds_on A", so we
# swap src/dst and rename the rel_type to keep the meaning stable.
class NormalizeRelationshipTaxonomy < ActiveRecord::Migration[7.1]
  def up
    # Swap src/dst on each prerequisite_for connection, then rename to builds_on.
    # Done in two passes to avoid relying on a temp column.
    affected = execute("SELECT id, src_concept_id, dst_concept_id FROM connections WHERE rel_type = 'prerequisite_for'").to_a
    affected.each do |row|
      execute(<<~SQL)
        UPDATE connections
        SET src_concept_id = #{row['dst_concept_id'].to_i},
            dst_concept_id = #{row['src_concept_id'].to_i},
            rel_type = 'builds_on'
        WHERE id = #{row['id'].to_i}
      SQL
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
