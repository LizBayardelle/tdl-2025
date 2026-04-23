class UploadBatchesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_upload_batch, only: [:show, :destroy, :start_processing, :add_files]

  def index
    @upload_batches = current_user.upload_batches.recent

    respond_to do |format|
      format.html
      format.json {
        render json: @upload_batches.map { |batch| batch_json(batch) }
      }
    end
  end

  def show
    respond_to do |format|
      format.html
      format.json {
        render json: batch_json(@upload_batch, include_items: true)
      }
    end
  end

  def create
    @upload_batch = current_user.upload_batches.build(
      name: params[:name] || "Upload #{Time.current.strftime('%Y-%m-%d %H:%M')}",
      status: :pending
    )

    if @upload_batch.save
      files = params[:files] || []
      files.each do |file|
        next unless file.content_type == 'application/pdf'

        item = @upload_batch.upload_batch_items.create!(
          original_filename: file.original_filename,
          file_size: file.size,
          status: :pending
        )
        item.pdf.attach(file)
      end

      @upload_batch.update!(total_count: @upload_batch.upload_batch_items.count)

      render json: batch_json(@upload_batch), status: :created
    else
      render json: { errors: @upload_batch.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @upload_batch.upload_batch_items.each do |item|
      item.pdf.purge if item.pdf.attached?
    end
    @upload_batch.destroy

    head :no_content
  end

  def active
    @upload_batch = current_user.upload_batches.active.first

    if @upload_batch
      render json: batch_json(@upload_batch, include_items: true)
    else
      render json: nil
    end
  end

  def add_files
    files = Array(params[:files])
    created = []
    failed = []

    files.each do |file|
      if file.respond_to?(:content_type) && file.content_type != 'application/pdf'
        failed << { name: file.original_filename, error: 'Not a PDF file' }
        next
      end

      begin
        item = @upload_batch.upload_batch_items.create!(
          original_filename: file.original_filename,
          file_size: file.size,
          status: :pending
        )
        item.pdf.attach(file)
        created << item
      rescue => e
        failed << { name: file.try(:original_filename), error: e.message }
      end
    end

    @upload_batch.update!(total_count: @upload_batch.upload_batch_items.count)

    render json: {
      batch: batch_json(@upload_batch),
      items: created.map { |i| item_json(i) },
      failed_files: failed
    }
  end

  def start_processing
    if @upload_batch.status_pending?
      @upload_batch.start_processing!
      render json: batch_json(@upload_batch)
    else
      render json: { error: 'Batch is not in pending status' }, status: :unprocessable_entity
    end
  end

  private

  def set_upload_batch
    @upload_batch = current_user.upload_batches.find(params[:id])
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
      json[:items] = batch.upload_batch_items.order(:id).map { |item| item_json(item) }
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
