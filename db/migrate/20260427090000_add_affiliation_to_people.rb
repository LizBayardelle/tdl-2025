# Adds the current employment + freshness stamp pulled from ORCID when a
# Person is enriched.  Stored as plain text rather than a structured
# institution record because affiliations are user-readable strings, not
# things we ever filter or join on.
class AddAffiliationToPeople < ActiveRecord::Migration[7.1]
  def change
    add_column :people, :affiliation, :text
    add_column :people, :affiliation_as_of, :datetime
  end
end
