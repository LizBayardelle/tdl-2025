class CreateNotificationsAndEnableTrgm < ActiveRecord::Migration[7.2]
  def change
    enable_extension "pg_trgm" unless extension_enabled?("pg_trgm")

    create_table :notifications do |t|
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.jsonb :payload, null: false, default: {}
      t.string :status, null: false, default: "pending"
      t.datetime :acted_at
      t.datetime :read_at
      t.timestamps
    end

    add_index :notifications, [:user_id, :status, :created_at], order: { created_at: :desc },
              name: "index_notifications_on_user_status_created"
    add_index :notifications, [:user_id, :read_at],
              name: "index_notifications_on_user_read"
    add_index :notifications, :kind

    add_index :concepts, "label gin_trgm_ops", using: :gin, name: "index_concepts_on_label_trgm"
  end
end
