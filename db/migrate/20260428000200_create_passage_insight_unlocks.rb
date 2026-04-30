class CreatePassageInsightUnlocks < ActiveRecord::Migration[7.1]
  def change
    create_table :passage_insight_unlocks do |t|
      t.references :user,   null: false, foreign_key: { on_delete: :cascade }
      t.references :source, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :granted_at, null: false
      t.timestamps
    end

    # One unlock row per (user, source).  Free users hit this once in their
    # lifetime; Storage users hit it up to 10 times per month — but for any
    # single source the row is created once and reused.
    add_index :passage_insight_unlocks, [:user_id, :source_id], unique: true

    # The hot quota query: "how many distinct papers has this user unlocked
    # since X."  granted_at filter for Storage's monthly window, no filter
    # for Free's lifetime cap.
    add_index :passage_insight_unlocks, [:user_id, :granted_at]
  end
end
