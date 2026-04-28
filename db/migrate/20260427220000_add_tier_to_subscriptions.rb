# Each Subscription row now records which tier (storage / premium) it
# represents so a user can hold both simultaneously and recompute_plan
# can pick the higher one without inferring from price.
class AddTierToSubscriptions < ActiveRecord::Migration[7.1]
  def up
    add_column :subscriptions, :tier, :string
    execute("UPDATE subscriptions SET tier = 'storage' WHERE tier IS NULL")
  end

  def down
    remove_column :subscriptions, :tier
  end
end
