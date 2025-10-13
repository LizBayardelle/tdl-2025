class NodesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_node, only: [:show, :update, :destroy]

  def index
    @nodes = current_user.nodes.recent

    respond_to do |format|
      format.html
      format.json { render json: @nodes }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json { render json: @node }
    end
  end

  def create
    @node = current_user.nodes.build(node_params.except(:people_ids))

    if @node.save
      # Create associations
      update_people_associations(@node, params[:node][:people_ids]) if params[:node][:people_ids]

      render json: @node, status: :created
    else
      render json: { errors: @node.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @node.update(node_params.except(:people_ids))
      # Update associations
      update_people_associations(@node, params[:node][:people_ids]) if params[:node][:people_ids]

      render json: @node
    else
      render json: { errors: @node.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @node.destroy
    head :no_content
  end

  private

  def set_node
    @node = current_user.nodes.find(params[:id])
  end

  def node_params
    params.require(:node).permit(
      :node_type,
      :label,
      :slug,
      :summary_top,
      :summary_mid,
      :summary_deep,
      :evidence_brief,
      :confidence_note,
      :level_status,
      :last_reviewed_on,
      mechanisms: [],
      signature_techniques: [],
      strengths: [],
      weaknesses: [],
      adjacent_models: [],
      contrasts_with: [],
      integrates_with: [],
      intake_questions: [],
      micro_skills: [],
      practice_prompts: [],
      assessment_links: [],
      tags: [],
      people_ids: []
    )
  end

  def update_people_associations(node, people_ids)
    return unless people_ids.is_a?(Array)

    # Clear existing associations
    node.person_nodes.destroy_all

    # Create new associations
    people_ids.each do |person_id|
      next if person_id.blank?
      person = current_user.people.find_by(id: person_id)
      node.person_nodes.create(person: person) if person
    end
  end
end
