class Share < ApplicationRecord
  belongs_to :owner, class_name: 'User'
  belongs_to :recipient, class_name: 'User', optional: true
  belongs_to :shareable, polymorphic: true

  enum :permission, { viewer: 'viewer', editor: 'editor', collaborator: 'collaborator' }

  validates :permission, presence: true
  validate :recipient_or_email_present
  validate :cannot_share_with_self

  before_create :generate_invite_token, if: :pending?
  after_create :send_invitation, if: :pending?

  scope :active, -> { where(active: true) }
  scope :pending, -> { where(recipient_id: nil).where.not(invited_email: nil) }

  def pending?
    recipient_id.nil? && invited_email.present?
  end

  def accept!(user)
    return false unless invited_email&.downcase == user.email&.downcase
    update!(recipient: user, invite_accepted_at: Time.current)
  end

  private

  def recipient_or_email_present
    errors.add(:base, "Recipient or email required") if recipient_id.nil? && invited_email.blank?
  end

  def cannot_share_with_self
    errors.add(:recipient, "cannot be yourself") if recipient_id == owner_id
  end

  def generate_invite_token
    self.invite_token = SecureRandom.urlsafe_base64(32)
  end

  def send_invitation
    ShareMailer.invitation(self).deliver_later
  end
end
