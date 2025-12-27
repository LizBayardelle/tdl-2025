class StandardizePeopleNames < ActiveRecord::Migration[7.2]
  def up
    # Convert "Last, First" to "First Last" format
    Person.where("full_name LIKE '%,%'").find_each do |person|
      # Split on comma
      parts = person.full_name.split(',').map(&:strip)

      if parts.length == 2
        # Simple case: "Last, First" -> "First Last"
        last_name = parts[0]
        first_name = parts[1]
        person.update_column(:full_name, "#{first_name} #{last_name}")
      elsif parts.length > 2
        # Handle cases like "Last, First, Suffix" -> "First Last, Suffix"
        last_name = parts[0]
        rest = parts[1..-1].join(', ')
        person.update_column(:full_name, "#{rest} #{last_name}")
      end
    end
  end

  def down
    # Can't reliably reverse this migration
    raise ActiveRecord::IrreversibleMigration
  end
end
