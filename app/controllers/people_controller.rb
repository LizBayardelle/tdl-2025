class PeopleController < ApplicationController
  before_action :authenticate_user!
  before_action :set_person, only: [:show, :update, :destroy]

  def index
    @people = current_user.people.alphabetical

    respond_to do |format|
      format.html
      format.json { render json: @people.includes(:nodes, :sources) }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: @person.as_json(
          include: {
            nodes: { only: [:id, :label, :node_type] },
            sources: { only: [:id, :title, :authors, :year] }
          }
        )
      }
    end
  end

  def create
    @person = current_user.people.build(person_params.except(:node_ids))

    if @person.save
      # Create associations
      update_node_associations(@person, params[:person][:node_ids]) if params[:person][:node_ids]

      render json: @person, status: :created
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @person.update(person_params.except(:node_ids))
      # Update associations
      update_node_associations(@person, params[:person][:node_ids]) if params[:person][:node_ids]

      render json: @person
    else
      render json: { errors: @person.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @person.destroy
    head :no_content
  end

  private

  def set_person
    @person = current_user.people.find(params[:id])
  end

  def person_params
    params.require(:person).permit(
      :full_name,
      :role,
      :summary,
      :attrs,
      aka: [],
      node_ids: []
    )
  end

  def update_node_associations(person, node_ids)
    return unless node_ids.is_a?(Array)

    # Clear existing associations
    person.person_nodes.destroy_all

    # Create new associations
    node_ids.each do |node_id|
      next if node_id.blank?
      node = current_user.nodes.find_by(id: node_id)
      person.person_nodes.create(node: node) if node
    end
  end
end
