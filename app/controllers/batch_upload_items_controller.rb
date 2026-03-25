class BatchUploadItemsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_item

  def show
    render json: item_json(@item)
  end

  def update
    # Update metadata and decisions
    if params[:extracted_metadata].present?
      @item.extracted_metadata = @item.extracted_metadata.merge(params[:extracted_metadata].to_unsafe_h)
    end

    if params[:user_decisions].present?
      @item.user_decisions = @item.user_decisions.merge(params[:user_decisions].to_unsafe_h)
    end

    if @item.save
      render json: item_json(@item)
    else
      render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def approve
    decisions = params[:decisions]&.to_unsafe_h || {}

    if @item.status_extracted? || @item.status_review_needed?
      @item.approve!(decisions)
      render json: item_json(@item)
    else
      render json: { error: "Item cannot be approved from status: #{@item.status}" }, status: :unprocessable_entity
    end
  end

  def retry
    if @item.status_failed?
      @item.retry!
      render json: item_json(@item)
    else
      render json: { error: 'Only failed items can be retried' }, status: :unprocessable_entity
    end
  end

  def skip
    if @item.status_approved? || @item.status_created? || @item.status_skipped?
      render json: { error: 'Item cannot be skipped' }, status: :unprocessable_entity
    else
      @item.skip!
      render json: item_json(@item)
    end
  end

  private

  def set_item
    @item = BatchUploadItem.joins(:batch_upload)
                           .where(batch_uploads: { user_id: current_user.id })
                           .find(params[:id])
  end

  def item_json(item)
    {
      id: item.id,
      batch_upload_id: item.batch_upload_id,
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
      created_at: item.created_at,
      updated_at: item.updated_at
    }
  end
end
