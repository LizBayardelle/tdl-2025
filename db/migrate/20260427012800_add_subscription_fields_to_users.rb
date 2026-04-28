class AddSubscriptionFieldsToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :plan, :string, default: "free", null: false
    add_column :users, :plan_through, :datetime
    add_column :users, :source_count_grace_until, :datetime
    add_column :users, :stripe_customer_id, :string

    add_index :users, :plan
    add_index :users, :stripe_customer_id, unique: true
  end
end
