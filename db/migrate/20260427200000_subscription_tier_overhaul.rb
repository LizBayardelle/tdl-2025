# Three-tier subscription model: Free / Storage / Premium.  Adds the
# concept-generation counter that paywalls the heavy AI-on-demand action.
# The mini-AI calls (research-type tagging, author suggestion, etc.) are
# unlimited on every paid tier and soft-capped on free at the controller
# layer — no DB column needed for those yet.
#
# Existing 'pro' rows are renamed to 'premium' to keep grandfathered users
# on the same level of access.  Free users stay free.
class SubscriptionTierOverhaul < ActiveRecord::Migration[7.1]
  def up
    add_column :users, :concept_generations_used, :integer, default: 0, null: false
    add_column :users, :concept_generations_reset_at, :datetime

    # Subscription rows now also know which tier they belong to.  Existing
    # rows are assumed to be 'storage' (the only tier we sold pre-overhaul).
    add_column :subscriptions, :tier, :string
    execute("UPDATE subscriptions SET tier = 'storage' WHERE tier IS NULL")

    # Migrate any existing pro users to premium (same level of access).
    execute("UPDATE users SET plan = 'premium' WHERE plan = 'pro'")
  end

  def down
    execute("UPDATE users SET plan = 'pro' WHERE plan = 'premium'")
    remove_column :subscriptions, :tier
    remove_column :users, :concept_generations_reset_at
    remove_column :users, :concept_generations_used
  end
end
