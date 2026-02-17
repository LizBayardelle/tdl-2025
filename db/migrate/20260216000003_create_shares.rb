class CreateShares < ActiveRecord::Migration[7.2]
  def change
    create_table :shares do |t|
      t.references :owner, null: false, foreign_key: { to_table: :users }
      t.references :recipient, foreign_key: { to_table: :users }

      # Polymorphic: Collection OR individual item (Source, Concept, Person, Note)
      t.string :shareable_type, null: false
      t.bigint :shareable_id, null: false

      t.string :permission, null: false, default: 'viewer'

      # For email invitations
      t.string :invited_email
      t.string :invite_token
      t.datetime :invite_sent_at
      t.datetime :invite_accepted_at

      t.boolean :active, default: true
      t.timestamps

      t.index [:shareable_type, :shareable_id]
      t.index :invited_email
      t.index :invite_token, unique: true, where: "invite_token IS NOT NULL"
    end
  end
end
