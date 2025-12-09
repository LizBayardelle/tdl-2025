class EnhanceSourcesTable < ActiveRecord::Migration[7.0]
  def change
    # Add URL field separate from DOI
    add_column :sources, :url, :string

    # Article-specific fields
    add_column :sources, :journal_name, :string
    add_column :sources, :volume, :string
    add_column :sources, :issue, :string
    add_column :sources, :pages, :string
    add_column :sources, :publication_date, :date
    add_column :sources, :abstract, :text

    # Book-specific fields
    add_column :sources, :book_title, :string
    add_column :sources, :edition, :string
    add_column :sources, :isbn, :string
    add_column :sources, :chapter_number, :integer

    # Website-specific fields
    add_column :sources, :website_name, :string
    add_column :sources, :access_date, :date

    # Enhanced metadata
    add_column :sources, :keywords, :json, default: []
    add_column :sources, :raw_metadata, :json
    add_column :sources, :formatted_citation, :text

    # Rename doi_or_url to just doi for clarity (url is now separate)
    rename_column :sources, :doi_or_url, :doi

    # Add index on DOI
    add_index :sources, :doi, unique: true, where: "doi IS NOT NULL"
  end
end
