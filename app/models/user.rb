class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_one_attached :profile_image

  has_many :concepts, dependent: :destroy
  has_many :connections, dependent: :destroy
  has_many :sources, dependent: :destroy
  has_many :people, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :highlight_colors, dependent: :destroy
  has_many :highlights, dependent: :destroy
  has_many :batch_uploads, dependent: :destroy
  has_many :user_packs, dependent: :destroy
  has_many :packs, through: :user_packs

  # Collections and shares
  has_many :collections, dependent: :destroy
  has_many :owned_shares, class_name: 'Share', foreign_key: :owner_id, dependent: :destroy
  has_many :received_shares, class_name: 'Share', foreign_key: :recipient_id, dependent: :destroy

  after_create :claim_pending_invitations

  private

  def claim_pending_invitations
    Share.pending.where(invited_email: email.downcase).find_each do |share|
      share.update!(recipient_id: id, invite_accepted_at: Time.current)
    end
  end
end
