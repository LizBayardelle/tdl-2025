class AddNameFieldsToPeople < ActiveRecord::Migration[7.2]
  def up
    add_column :people, :first_name, :string
    add_column :people, :middle_name, :string
    add_column :people, :last_name, :string

    # Populate fields from existing full_name data
    Person.find_each do |person|
      next if person.full_name.blank?

      # Simple parsing: assume "First [Middle] Last" format
      parts = person.full_name.split(/\s+/)

      if parts.length == 1
        # Just one name - treat as last name
        person.update_columns(last_name: parts[0])
      elsif parts.length == 2
        # First Last
        person.update_columns(first_name: parts[0], last_name: parts[1])
      else
        # First Middle(s) Last
        person.update_columns(
          first_name: parts[0],
          middle_name: parts[1..-2].join(' '),
          last_name: parts[-1]
        )
      end
    end
  end

  def down
    remove_column :people, :first_name
    remove_column :people, :middle_name
    remove_column :people, :last_name
  end
end
