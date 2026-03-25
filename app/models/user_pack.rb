class UserPack < ApplicationRecord
  belongs_to :user
  belongs_to :pack

  validates :user_id, uniqueness: { scope: :pack_id }
end
