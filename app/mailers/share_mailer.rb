class ShareMailer < ApplicationMailer
  helper_method :shareable_display_name

  def invitation(share)
    @share = share
    @owner = share.owner
    @shareable = share.shareable
    @accept_url = accept_share_url(token: share.invite_token)

    mail(
      to: share.invited_email,
      subject: "#{@owner.email} shared \"#{shareable_name(@shareable)}\" with you"
    )
  end

  private

  def shareable_name(obj)
    case obj
    when Collection then obj.name
    when Source then obj.title
    when Concept then obj.label
    when Person then obj.full_name
    when Note then obj.title || "a note"
    end
  end

  def shareable_display_name
    shareable_name(@shareable)
  end
end
