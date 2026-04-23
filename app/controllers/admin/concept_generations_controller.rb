module Admin
  class ConceptGenerationsController < BaseController
    before_action :set_generation, only: [:show, :update, :approve, :reject, :retry_stage]

    def index
      @generations = ConceptGeneration.order(created_at: :desc).includes(:batch)

      respond_to do |format|
        format.html
        format.json { render json: @generations.map { |g| serialize_generation(g) } }
      end
    end

    def new
      # React form handles this; just renders the mount point
    end

    def create
      name = params[:concept_name].to_s.strip
      concept_type = params[:concept_type].presence
      target_mode = params[:target_mode].presence || 'create_new'
      target_id = params[:target_concept_definition_id].presence

      if name.blank?
        return render json: { errors: ['concept_name is required'] }, status: :unprocessable_entity
      end

      slug = name.parameterize
      existing = ConceptDefinition.where('lower(label) = ? OR label = ?', name.downcase, name).first

      # If caller hasn't decided yet, surface the duplicate for them to choose.
      if existing && target_mode == 'create_new' && !params[:ignore_duplicate]
        return render json: {
          duplicate: true,
          existing_concept_definition: {
            id: existing.id,
            label: existing.label,
            pack_id: existing.pack_id,
            summary: existing.summary
          }
        }, status: :conflict
      end

      batch = ConceptGenerationBatch.create!(user: current_user, name: "Generate: #{name}")
      generation = batch.concept_generations.create!(
        concept_name: name,
        concept_type: concept_type,
        target_mode: target_mode,
        target_concept_definition_id: target_mode == 'regenerate_existing' ? target_id : nil
      )

      batch.update!(total_count: 1, status: :generating, started_at: Time.current)
      generation.start_generation!

      render json: { id: generation.id, batch_id: batch.id }, status: :created
    end

    def show
      respond_to do |format|
        format.html
        format.json { render json: serialize_generation(@generation, include_content: true) }
      end
    end

    def update
      allowed = params.require(:concept_generation).permit(
        :label, :summary, :description, :location, :examples, :etymology,
        :school_of_thought, :history, :controversy, :clinical_relevance,
        :misconceptions, :mnemonic, :developmental_notes, :measurement_notes,
        aliases: []
      )

      if @generation.update(allowed)
        render json: serialize_generation(@generation, include_content: true)
      else
        render json: { errors: @generation.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def approve
      unless @generation.status_ready_for_review?
        return render json: { errors: ['generation must be ready_for_review to approve'] }, status: :unprocessable_entity
      end

      ActiveRecord::Base.transaction do
        cd = build_or_update_concept_definition
        cd.save!
        @generation.update!(
          status: :approved,
          approved_at: Time.current,
          approved_concept_definition_id: cd.id
        )
      end

      render json: serialize_generation(@generation, include_content: true)
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
    end

    def reject
      reason = params[:reason].to_s.strip
      @generation.update!(status: :rejected, rejected_reason: reason.presence)
      render json: serialize_generation(@generation, include_content: true)
    end

    # Re-enqueue a specific stage. Stage 3 (link enrichment) will plug in
    # here when it comes online.
    def retry_stage
      stage = params[:stage].to_s
      case stage
      when 'generate'
        # Full restart from scratch — wipes any stage-2 fact-check work.
        @generation.update!(
          status: :generating,
          stage_errors: @generation.stage_errors.except('generate', 'fact_check'),
          fact_check_notes: [],
          previous_snapshot: {}
        )
        job = GenerateConceptContentJob.perform_later(@generation.id)
        @generation.update_column(:generate_job_id, job.job_id)
      when 'fact_check'
        # Restore the post-generation snapshot, then re-run stage 2 against
        # the original draft. Skips redoing the expensive stage 1.
        snapshot = @generation.previous_snapshot&.dig('after_generate')
        if snapshot.present?
          ConceptGeneration::CONTENT_FIELDS.each do |field|
            @generation[field] = snapshot[field] if snapshot.key?(field)
          end
        end
        @generation.assign_attributes(
          status: :fact_checking,
          stage_errors: @generation.stage_errors.except('fact_check'),
          fact_check_notes: []
        )
        @generation.save!
        job = FactCheckConceptJob.perform_later(@generation.id)
        @generation.update_column(:fact_check_job_id, job.job_id)
      else
        return render json: { errors: ["unknown stage: #{stage}"] }, status: :unprocessable_entity
      end

      render json: serialize_generation(@generation, include_content: true)
    end

    private

    def set_generation
      @generation = ConceptGeneration.find(params[:id])
    end

    def build_or_update_concept_definition
      cd = if @generation.target_mode_regenerate_existing? && @generation.target_concept_definition_id
        ConceptDefinition.find(@generation.target_concept_definition_id)
      else
        ConceptDefinition.new
      end

      ConceptGeneration::CONTENT_FIELDS.each do |field|
        value = @generation.send(field)
        cd.send("#{field}=", value) unless value.nil?
      end

      # concept_type wasn't in the generated content fields; pull from the row
      cd.concept_type = @generation.concept_type if @generation.concept_type.present? && cd.concept_type.blank?

      # Fallback: if label is empty, use the concept_name
      cd.label = @generation.concept_name if cd.label.blank?

      cd
    end

    def serialize_generation(gen, include_content: false)
      base = {
        id: gen.id,
        concept_name: gen.concept_name,
        concept_type: gen.concept_type,
        status: gen.status,
        target_mode: gen.target_mode,
        target_concept_definition_id: gen.target_concept_definition_id,
        approved_concept_definition_id: gen.approved_concept_definition_id,
        approved_at: gen.approved_at,
        rejected_reason: gen.rejected_reason,
        created_at: gen.created_at,
        updated_at: gen.updated_at,
        batch_id: gen.concept_generation_batch_id,
        stage_errors: gen.stage_errors
      }

      return base unless include_content

      content = ConceptGeneration::CONTENT_FIELDS.each_with_object({}) do |field, hash|
        hash[field] = gen.send(field)
      end

      base.merge(
        content: content,
        citations: gen.citations,
        web_search_sources: gen.web_search_sources,
        fact_check_notes: gen.fact_check_notes,
        token_usage: gen.token_usage
      )
    end
  end
end
