module Admin
  class UsersController < BaseController
    def index
      @users = User.order(created_at: :desc).limit(100)

      respond_to do |format|
        format.html
        format.json {
          render json: @users.map { |user|
            {
              id: user.id,
              email: user.email,
              admin: user.admin,
              created_at: user.created_at,
              concepts_count: user.concepts.count
            }
          }
        }
      end
    end

    def update
      @user = User.find(params[:id])
      if @user.update(user_params)
        render json: { id: @user.id, email: @user.email, admin: @user.admin }
      else
        render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def user_params
      params.require(:user).permit(:admin)
    end
  end
end
