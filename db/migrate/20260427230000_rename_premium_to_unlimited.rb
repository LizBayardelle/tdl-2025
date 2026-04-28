# Renames the top tier from 'premium' to 'unlimited' to match the customer-
# facing name change.  The earlier overhaul already migrated any historical
# 'pro' rows to 'premium'; this folds those forward to the new name.
class RenamePremiumToUnlimited < ActiveRecord::Migration[7.1]
  def up
    execute("UPDATE users SET plan = 'unlimited' WHERE plan = 'premium'")
    execute("UPDATE subscriptions SET tier = 'unlimited' WHERE tier = 'premium'")
  end

  def down
    execute("UPDATE users SET plan = 'premium' WHERE plan = 'unlimited'")
    execute("UPDATE subscriptions SET tier = 'premium' WHERE tier = 'unlimited'")
  end
end
