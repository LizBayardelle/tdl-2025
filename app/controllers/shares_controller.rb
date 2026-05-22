class SharesController < ApplicationController
  before_action :authenticate_user!, except: [:accept]

  # Shares I created
  def index
    @shares = current_user.owned_shares.active.includes(:recipient, :shareable)
    render json: serialize_shares(@shares, :outgoing)
  end

  # Shares given to me
  def received
    @shares = current_user.received_shares.active.includes(:owner, :shareable)
    render json: serialize_shares(@shares, :incoming)
  end

  def create
    shareable = find_shareable

    unless shareable_owned_by_user?(shareable)
      return render json: { error: 'Only owners can share' }, status: :forbidden
    end

    recipient = User.find_by(email: share_params[:email]&.downcase)

    @share = current_user.owned_shares.build(
      shareable: shareable,
      permission: share_params[:permission] || 'viewer',
      recipient: recipient,
      invited_email: recipient ? nil : share_params[:email]&.downcase,
      include_source_notes: share_params[:include_source_notes] == true || share_params[:include_source_notes] == 'true'
    )

    if @share.save
      render json: @share, status: :created
    else
      render json: { errors: @share.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    @share = current_user.owned_shares.find(params[:id])
    if @share.update(share_params.slice(:permission, :active, :include_source_notes))
      render json: @share
    else
      render json: { errors: @share.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @share = current_user.owned_shares.find(params[:id])
    @share.update!(active: false)
    head :no_content
  end

  def accept
    @share = Share.find_by!(invite_token: params[:token])

    if current_user
      if @share.accept!(current_user)
        redirect_to dashboard_path, notice: "Share accepted!"
      else
        redirect_to dashboard_path, alert: "Could not accept share"
      end
    else
      # Store token in session and redirect to sign in
      session[:pending_share_token] = params[:token]
      redirect_to new_user_session_path, notice: "Please sign in or create an account to accept this share"
    end
  end

  private

  def share_params
    params.require(:share).permit(:email, :permission, :shareable_type, :shareable_id, :active, :include_source_notes)
  end

  def find_shareable
    type = share_params[:shareable_type]
    raise ActionController::BadRequest, "Invalid type" unless %w[Collection Source Concept Person Note].include?(type)
    type.constantize.find(share_params[:shareable_id])
  end

  def shareable_owned_by_user?(shareable)
    shareable.user_id == current_user.id
  end

  def serialize_shares(shares, direction)
    shares.map do |s|
      {
        id: s.id,
        shareable_type: s.shareable_type,
        shareable_id: s.shareable_id,
        shareable_name: shareable_name(s.shareable),
        permission: s.permission,
        email: direction == :outgoing ? (s.recipient&.email || s.invited_email) : s.owner.email,
        pending: s.pending?,
        include_source_notes: s.include_source_notes,
        created_at: s.created_at
      }
    end
  end

  def shareable_name(obj)
    case obj
    when Collection then obj.name
    when Source then obj.title
    when Concept then obj.label
    when Person then obj.full_name
    when Note then obj.title || obj.body&.truncate(50)
    end
  end
end
