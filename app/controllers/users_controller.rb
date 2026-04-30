class UsersController < ApplicationController
  before_action :authenticate_user!

  # GET /users/me.json — current user's plan, quotas, and counters.  Used by
  # the dashboard to render "Library additions left" and other tier-aware
  # stats.
  def me
    render json: {
      id: current_user.id,
      email: current_user.email,
      plan: current_user.effective_plan,
      sources_count: current_user.sources_count,
      sources_limit: User::FREE_SOURCE_LIMIT,
      library_additions: current_user.concept_generation_quota,
      note_taking: current_user.paper_unlock_quota,
    }
  end

  def update_profile_image
    if params[:profile_image].present?
      current_user.profile_image.attach(params[:profile_image])

      if current_user.save
        respond_to do |format|
          format.json do
            render json: {
              success: true,
              image_url: url_for(current_user.profile_image.variant(resize_to_fill: [96, 96]))
            }
          end
          format.html { redirect_to edit_user_registration_path, notice: "Profile image updated." }
        end
      else
        respond_to do |format|
          format.json { render json: { success: false, errors: current_user.errors.full_messages }, status: :unprocessable_entity }
          format.html { redirect_to edit_user_registration_path, alert: "Failed to update profile image." }
        end
      end
    else
      respond_to do |format|
        format.json { render json: { success: false, errors: ["No image provided"] }, status: :unprocessable_entity }
        format.html { redirect_to edit_user_registration_path, alert: "No image provided." }
      end
    end
  end
end
