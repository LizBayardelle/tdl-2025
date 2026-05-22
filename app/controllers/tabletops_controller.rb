class TabletopsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_tabletop, only: [:show, :update, :destroy, :viewport, :import_notes, :sources_index]
  before_action :authorize_edit!, only: [:update, :destroy, :viewport, :import_notes]

  # GET /tabletops
  def index
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Tabletop)
    @tabletops = Tabletop.where(id: accessible_ids).recent

    respond_to do |format|
      format.html
      format.json {
        render json: @tabletops.map { |t|
          t.as_json(only: [:id, :name, :description, :last_opened_at, :created_at, :updated_at])
            .merge(
              items_count: t.items_count,
              notes_count: t.notes_count,
              tags: t.tags.pluck(:name),
              permission: t.permission_for(current_user),
              is_owner:   t.user_id == current_user.id
            )
        }
      }
    end
  end

  # GET /tabletops/:id
  def show
    @tabletop.touch_opened! if @tabletop.user_id == current_user.id

    respond_to do |format|
      format.html
      format.json { render json: tabletop_payload(@tabletop) }
    end
  end

  # POST /tabletops
  def create
    @tabletop = current_user.tabletops.build(tabletop_params)
    if @tabletop.save
      render json: tabletop_payload(@tabletop), status: :created
    else
      render json: { errors: @tabletop.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /tabletops/:id
  def update
    raw = params.require(:tabletop)
    if @tabletop.update(tabletop_params)
      sync_collections(@tabletop, raw[:collection_ids]) if raw.key?(:collection_ids)
      render json: tabletop_payload(@tabletop)
    else
      render json: { errors: @tabletop.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /tabletops/:id/viewport — debounced pan/zoom persistence
  def viewport
    @tabletop.update_columns(
      view_x:    params[:view_x].to_f,
      view_y:    params[:view_y].to_f,
      view_zoom: [params[:view_zoom].to_f, 0.1].max
    )
    head :no_content
  end

  # POST /tabletops/:id/import_notes
  # Bulk-create note items from a list of note IDs.  Skips notes already on
  # the tabletop and ignores IDs the user can't access.
  #
  # `mode` controls placement:
  #   'staged' (default) — items are flagged staged: true and don't get
  #                        canvas coords, so they land in the tray instead
  #                        of dropping on top of the user's curated layout.
  #   'grid'             — items are placed immediately in a snapped
  #                        3-column grid below existing items.
  def import_notes
    mode = (params[:mode].presence || 'staged').to_s
    mode = 'staged' unless %w[staged grid].include?(mode)

    requested = Array(params[:note_ids]).map(&:to_i).reject(&:zero?).uniq
    auth = AuthorizationService.new(current_user)
    accessible_ids = auth.accessible_ids(Note) & requested
    notes = Note.where(id: accessible_ids).index_by(&:id)

    existing_note_ids = @tabletop.tabletop_items.where(kind: 'note').pluck(:item_id).to_set
    fresh_ids   = accessible_ids.reject { |id| existing_note_ids.include?(id) }
    skipped_ids = accessible_ids.select { |id| existing_note_ids.include?(id) }

    next_z = (@tabletop.tabletop_items.maximum(:z_index) || 0) + 1

    if mode == 'grid'
      note_w = 280
      row_h  = 220
      gap    = 24
      cols   = 3
      snap   = 8
      snap_to = ->(n) { (n / snap.to_f).round * snap }

      base_y  = @tabletop.tabletop_items.where(staged: false).maximum(Arel.sql("y + COALESCE(height, 200)")) || 0
      start_x = snap_to.call(60)
      start_y = snap_to.call(base_y > 0 ? base_y + 48 : 60)
    end

    created = []
    Tabletop.transaction do
      fresh_ids.each_with_index do |note_id, i|
        attrs = {
          kind:    'note',
          item:    notes[note_id],
          z_index: next_z + i,
          staged:  mode == 'staged',
        }
        if mode == 'grid'
          col = i % cols
          row = i / cols
          attrs[:x] = snap_to.call(start_x + col * (note_w + gap))
          attrs[:y] = snap_to.call(start_y + row * (row_h + gap))
        else
          attrs[:x] = 0
          attrs[:y] = 0
        end
        created << @tabletop.tabletop_items.create!(attrs)
      end
      @tabletop.touch_opened!
    end

    render json: {
      tabletop_id:    @tabletop.id,
      tabletop_name:  @tabletop.name,
      added:          created.size,
      staged:         mode == 'staged' ? created.size : 0,
      skipped:        skipped_ids.size,
      not_accessible: requested.size - accessible_ids.size,
      mode:           mode,
    }
  end

  # DELETE /tabletops/:id
  def destroy
    @tabletop.destroy
    head :no_content
  end

  # GET /tabletops/:id/sources
  # Mounts the SourcesIndex React component scoped to this tabletop —
  # shows every source attached to a note on the table, plus any
  # sources placed directly as items on the canvas.
  def sources_index
  end

  private

  def set_tabletop
    @tabletop = Tabletop.find(params[:id])
    head :forbidden unless @tabletop.shared_with?(current_user)
  end

  def authorize_edit!
    head :forbidden unless @tabletop.user_id == current_user.id ||
                           %w[owner editor collaborator].include?(@tabletop.permission_for(current_user))
  end

  def tabletop_params
    params.require(:tabletop).permit(:name, :description, tags: [])
  end

  # Reconcile this tabletop's collection memberships against the supplied
  # ID list.  Sharing is collection-driven, so this is the lever that
  # decides who else can see / edit the tabletop.
  def sync_collections(tabletop, collection_ids)
    desired = Array(collection_ids).map(&:to_i).reject(&:zero?).to_set
    current = tabletop.collection_items.pluck(:collection_id).to_set
    to_remove = current - desired
    to_add    = desired - current
    tabletop.collection_items.where(collection_id: to_remove.to_a).destroy_all if to_remove.any?
    to_add.each do |cid|
      collection = Collection.find_by(id: cid)
      next unless collection
      next unless collection.user_id == current_user.id || collection.shared_with?(current_user)
      CollectionItem.find_or_create_by!(collection: collection, collectable: tabletop)
    end
  end

  def tabletop_payload(t)
    t.as_json(only: [:id, :name, :description, :view_x, :view_y, :view_zoom, :last_opened_at, :created_at, :updated_at])
      .merge(
        tags:        t.tags.pluck(:name),
        items:       t.tabletop_items.map { |ti| serialize_item(ti) },
        collections: t.collections.map { |c| { id: c.id, name: c.name } },
        permission:  t.permission_for(current_user),
        is_owner:    t.user_id == current_user.id
      )
  end

  def serialize_item(ti)
    payload = ti.as_json(only: [
      :id, :kind, :item_id, :item_type, :x, :y, :width, :height, :rotation,
      :z_index, :body, :start_x, :start_y, :end_x, :end_y, :color, :staged,
      :start_anchor_id, :end_anchor_id, :start_anchor_side, :end_anchor_side
    ])
    payload[:item_data] = item_data_for(ti)
    payload
  end

  # Inline a small snapshot of the linked entity so the canvas can render
  # without an extra round trip per item.
  def item_data_for(ti)
    return nil unless ti.item
    case ti.item
    when Note
      n = ti.item
      {
        id: n.id, title: n.title, body: n.body, note_type: n.note_type,
        quote_text: n.quote_text, page_number: n.page_number, pinned: n.pinned,
        noted_on: n.noted_on, created_at: n.created_at,
        source: n.source && { id: n.source.id, title: n.source.title },
        concepts: n.concepts.map { |c| { id: c.id, label: c.label } },
        people:   n.people.map { |p| { id: p.id, full_name: p.full_name } },
        tags:     n.tags.pluck(:name)
      }
    when Source
      { id: ti.item.id, title: ti.item.title, year: ti.item.year, kind: ti.item.kind }
    when Concept
      { id: ti.item.id, label: ti.item.label, concept_type: ti.item.concept_type }
    end
  end
end
