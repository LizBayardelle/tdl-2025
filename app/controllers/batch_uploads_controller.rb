class BatchUploadsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_batch_upload, only: [:show, :destroy, :start_processing]

  def index
    @batch_uploads = current_user.batch_uploads.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @batch_uploads.map { |batch| batch_json(batch) }
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: batch_json(@batch_upload, include_items: true)
      }
    end
  end

  def create
    @batch_upload = current_user.batch_uploads.build(
      name: params[:name] || "Upload #{Time.current.strftime('%Y-%m-%d %H:%M')}",
      status: :pending
    )

    if @batch_upload.save
      # Create items for each uploaded file
      files = params[:files] || []
      files.each do |file|
        next unless file.content_type == 'application/pdf'

        item = @batch_upload.batch_upload_items.create!(
          original_filename: file.original_filename,
          file_size: file.size,
          status: :pending
        )
        item.pdf.attach(file)
      end

      @batch_upload.update!(total_count: @batch_upload.batch_upload_items.count)

      render json: batch_json(@batch_upload), status: :created
    else
      render json: { errors: @batch_upload.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @batch_upload.batch_upload_items.each do |item|
      item.pdf.purge if item.pdf.attached?
    end
    @batch_upload.destroy

    head :no_content
  end

  def active
    @batch_upload = current_user.batch_uploads.active.first

    if @batch_upload
      render json: batch_json(@batch_upload, include_items: true)
    else
      render json: nil
    end
  end

  def start_processing
    if @batch_upload.status_pending?
      @batch_upload.start_processing!
      render json: batch_json(@batch_upload)
    else
      render json: { error: 'Batch is not in pending status' }, status: :unprocessable_entity
    end
  end

  private

  def set_batch_upload
    @batch_upload = current_user.batch_uploads.find(params[:id])
  end

  def batch_json(batch, include_items: false)
    json = {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      total_count: batch.total_count,
      completed_count: batch.completed_count,
      failed_count: batch.failed_count,
      progress_percentage: batch.progress_percentage,
      stats: batch.stats,
      started_at: batch.started_at,
      completed_at: batch.completed_at,
      created_at: batch.created_at,
      updated_at: batch.updated_at
    }

    if include_items
      json[:items] = batch.batch_upload_items.order(:id).map { |item| item_json(item) }
    end

    json
  end

  def item_json(item)
    {
      id: item.id,
      status: item.status,
      original_filename: item.original_filename,
      file_size: item.file_size,
      extracted_metadata: item.extracted_metadata,
      extracted_doi: item.extracted_doi,
      extraction_method: item.extraction_method,
      detected_authors: item.detected_authors,
      detected_concepts: item.detected_concepts,
      duplicate_candidates: item.duplicate_candidates,
      user_decisions: item.user_decisions,
      error_message: item.error_message,
      retry_count: item.retry_count,
      source_id: item.source_id,
      has_duplicates: item.has_duplicates?,
      needs_author_review: item.needs_author_review?,
      needs_concept_review: item.needs_concept_review?,
      pdf_url: item.pdf.attached? ? Rails.application.routes.url_helpers.rails_blob_path(item.pdf, only_path: true) : nil,
      created_at: item.created_at,
      updated_at: item.updated_at
    }
  end
end
