class CreateSubscriptions < ActiveRecord::Migration[7.2]
  def change
    create_table :subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.string :provider, null: false             # "stripe", "apple", "manual"
      t.string :external_id, null: false          # stripe sub id, apple original_transaction_id, etc.
      t.string :external_customer_id              # stripe customer id, apple account, etc.
      t.string :status, null: false               # "active", "past_due", "canceled", "expired"
      t.string :interval, null: false             # "month", "year"
      t.integer :amount_cents
      t.string :currency, default: "usd"
      t.datetime :current_period_end
      t.boolean :cancel_at_period_end, default: false, null: false
      t.datetime :canceled_at
      t.text :cancellation_reason

      t.timestamps
    end

    add_index :subscriptions, [:provider, :external_id], unique: true
    add_index :subscriptions, [:user_id, :status]
    add_index :subscriptions, :status
  end
end
