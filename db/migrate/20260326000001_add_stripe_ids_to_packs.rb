class AddStripeIdsToPacks < ActiveRecord::Migration[7.2]
  def change
    add_column :packs, :stripe_product_id, :string
    add_column :packs, :stripe_price_id, :string
    add_index :packs, :stripe_product_id, unique: true
    add_index :packs, :stripe_price_id, unique: true
  end
end
