# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_05_25_010000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_trgm"
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "allowed_domains", force: :cascade do |t|
    t.string "domain", null: false
    t.string "category"
    t.boolean "active", default: true, null: false
    t.text "notes"
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_allowed_domains_on_active"
    t.index ["added_by_id"], name: "index_allowed_domains_on_added_by_id"
    t.index ["category"], name: "index_allowed_domains_on_category"
    t.index ["domain"], name: "index_allowed_domains_on_domain", unique: true
  end

  create_table "authors", force: :cascade do |t|
    t.string "last_name"
    t.string "first_name"
    t.string "middle_initial"
    t.string "full_name"
    t.string "orcid"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["full_name"], name: "index_authors_on_full_name"
    t.index ["orcid"], name: "index_authors_on_orcid", unique: true, where: "(orcid IS NOT NULL)"
    t.index ["user_id"], name: "index_authors_on_user_id"
  end

  create_table "bibliography_entries", force: :cascade do |t|
    t.bigint "collection_id", null: false
    t.bigint "source_id", null: false
    t.text "internal_annotation"
    t.text "formal_annotation"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["collection_id", "source_id"], name: "index_bibliography_entries_on_collection_and_source", unique: true
    t.index ["collection_id"], name: "index_bibliography_entries_on_collection_id"
    t.index ["source_id"], name: "index_bibliography_entries_on_source_id"
  end

  create_table "collection_groupings", force: :cascade do |t|
    t.bigint "collection_id", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["collection_id", "name"], name: "index_collection_groupings_on_collection_id_and_name", unique: true
    t.index ["collection_id", "position"], name: "index_collection_groupings_on_collection_id_and_position"
    t.index ["collection_id"], name: "index_collection_groupings_on_collection_id"
  end

  create_table "collection_items", force: :cascade do |t|
    t.bigint "collection_id", null: false
    t.string "collectable_type", null: false
    t.bigint "collectable_id", null: false
    t.datetime "added_at", default: -> { "CURRENT_TIMESTAMP" }
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "grouping_id"
    t.index ["added_by_id"], name: "index_collection_items_on_added_by_id"
    t.index ["collectable_type", "collectable_id"], name: "index_collection_items_on_collectable_type_and_collectable_id"
    t.index ["collection_id", "collectable_type", "collectable_id"], name: "idx_collection_items_unique", unique: true
    t.index ["collection_id"], name: "index_collection_items_on_collection_id"
    t.index ["grouping_id"], name: "index_collection_items_on_grouping_id"
  end

  create_table "collections", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "slug", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "active", default: true, null: false
    t.index ["active"], name: "index_collections_on_active"
    t.index ["user_id", "slug"], name: "index_collections_on_user_id_and_slug", unique: true
    t.index ["user_id"], name: "index_collections_on_user_id"
  end

  create_table "concept_definition_domains", id: false, force: :cascade do |t|
    t.bigint "concept_definition_id", null: false
    t.bigint "domain_id", null: false
    t.index ["concept_definition_id", "domain_id"], name: "idx_concept_def_domains_unique", unique: true
    t.index ["concept_definition_id"], name: "index_concept_definition_domains_on_concept_definition_id"
    t.index ["domain_id"], name: "index_concept_definition_domains_on_domain_id"
  end

  create_table "concept_definitions", force: :cascade do |t|
    t.string "label", null: false
    t.text "aliases", default: [], array: true
    t.string "concept_type"
    t.text "summary"
    t.text "description"
    t.text "location"
    t.text "examples"
    t.text "etymology"
    t.text "school_of_thought"
    t.text "history"
    t.text "controversy"
    t.text "clinical_relevance"
    t.text "misconceptions"
    t.text "mnemonic"
    t.text "developmental_notes"
    t.text "measurement_notes"
    t.jsonb "external_refs", default: []
    t.text "attribution"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "slug"
    t.integer "rejection_count", default: 0, null: false
    t.integer "linked_count_cache", default: 0, null: false
    t.index ["concept_type"], name: "index_concept_definitions_on_concept_type"
    t.index ["label"], name: "index_concept_definitions_on_label"
    t.index ["slug", "concept_type"], name: "index_concept_definitions_on_slug_and_concept_type"
  end

  create_table "concept_disambiguations", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "concept_a_id", null: false
    t.bigint "concept_b_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_a_id"], name: "index_concept_disambiguations_on_concept_a_id"
    t.index ["concept_b_id"], name: "index_concept_disambiguations_on_concept_b_id"
    t.index ["user_id", "concept_a_id", "concept_b_id"], name: "index_concept_disambiguations_unique", unique: true
    t.index ["user_id"], name: "index_concept_disambiguations_on_user_id"
    t.check_constraint "concept_a_id < concept_b_id", name: "concept_disambiguations_ordered_pair_check"
  end

  create_table "concept_domains", id: false, force: :cascade do |t|
    t.bigint "concept_id", null: false
    t.bigint "domain_id", null: false
    t.index ["concept_id", "domain_id"], name: "index_concept_domains_on_concept_id_and_domain_id", unique: true
    t.index ["concept_id"], name: "index_concept_domains_on_concept_id"
    t.index ["domain_id"], name: "index_concept_domains_on_domain_id"
  end

  create_table "concept_generation_batches", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name"
    t.string "status", default: "pending", null: false
    t.integer "total_count", default: 0
    t.integer "generated_count", default: 0
    t.integer "approved_count", default: 0
    t.integer "rejected_count", default: 0
    t.integer "failed_count", default: 0
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_concept_generation_batches_on_status"
    t.index ["user_id", "status"], name: "index_concept_generation_batches_on_user_id_and_status"
    t.index ["user_id"], name: "index_concept_generation_batches_on_user_id"
  end

  create_table "concept_generations", force: :cascade do |t|
    t.bigint "concept_generation_batch_id", null: false
    t.string "concept_name", null: false
    t.string "concept_type"
    t.string "target_mode", default: "create_new", null: false
    t.bigint "target_concept_definition_id"
    t.string "status", default: "pending", null: false
    t.text "label"
    t.text "aliases", default: [], array: true
    t.text "summary"
    t.text "description"
    t.text "location"
    t.text "examples"
    t.text "etymology"
    t.text "school_of_thought"
    t.text "history"
    t.text "controversy"
    t.text "clinical_relevance"
    t.text "misconceptions"
    t.text "mnemonic"
    t.text "developmental_notes"
    t.text "measurement_notes"
    t.jsonb "citations", default: {}
    t.jsonb "web_search_sources", default: []
    t.jsonb "fact_check_notes", default: []
    t.jsonb "stage_errors", default: {}
    t.jsonb "token_usage", default: {}
    t.jsonb "previous_snapshot", default: {}
    t.string "generate_job_id"
    t.string "fact_check_job_id"
    t.string "enrich_job_id"
    t.bigint "approved_concept_definition_id"
    t.datetime "approved_at"
    t.text "rejected_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "selected_links", default: []
    t.datetime "enrich_completed_at"
    t.text "attribution"
    t.index ["approved_concept_definition_id"], name: "index_concept_generations_on_approved_concept_definition_id"
    t.index ["concept_generation_batch_id", "status"], name: "idx_concept_generations_on_batch_status"
    t.index ["concept_generation_batch_id"], name: "idx_concept_generations_on_batch"
    t.index ["status"], name: "index_concept_generations_on_status"
    t.index ["target_concept_definition_id"], name: "index_concept_generations_on_target_concept_definition_id"
  end

  create_table "concept_notes", force: :cascade do |t|
    t.bigint "note_id", null: false
    t.bigint "concept_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_id"], name: "index_concept_notes_on_concept_id"
    t.index ["note_id"], name: "index_concept_notes_on_note_id"
  end

  create_table "concept_sources", force: :cascade do |t|
    t.bigint "concept_id", null: false
    t.bigint "source_id", null: false
    t.string "role"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_id", "source_id"], name: "index_concept_sources_on_concept_id_and_source_id", unique: true
    t.index ["concept_id"], name: "index_concept_sources_on_concept_id"
    t.index ["role"], name: "index_concept_sources_on_role"
    t.index ["source_id"], name: "index_concept_sources_on_source_id"
  end

  create_table "concepts", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "label", null: false
    t.string "slug", null: false
    t.text "tags", default: [], array: true
    t.date "last_reviewed_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "definition_id"
    t.string "concept_type"
    t.text "aliases", default: [], array: true
    t.text "summary"
    t.text "description"
    t.text "location"
    t.text "examples"
    t.text "etymology"
    t.text "school_of_thought"
    t.text "history"
    t.text "controversy"
    t.text "clinical_relevance"
    t.text "misconceptions"
    t.text "mnemonic"
    t.text "developmental_notes"
    t.text "measurement_notes"
    t.jsonb "external_refs", default: []
    t.string "definition_acquired_via"
    t.index ["concept_type"], name: "index_concepts_on_concept_type"
    t.index ["definition_id"], name: "index_concepts_on_definition_id"
    t.index ["label"], name: "index_concepts_on_label_trgm", opclass: :gin_trgm_ops, using: :gin
    t.index ["slug"], name: "index_concepts_on_slug", unique: true
    t.index ["user_id"], name: "index_concepts_on_user_id"
  end

  create_table "connections", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "src_concept_id", null: false
    t.bigint "dst_concept_id", null: false
    t.string "rel_type", null: false
    t.text "description"
    t.text "tags", default: [], array: true
    t.date "last_reviewed_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "relationship_label"
    t.index ["dst_concept_id"], name: "index_connections_on_dst_concept_id"
    t.index ["rel_type"], name: "index_connections_on_rel_type"
    t.index ["src_concept_id", "dst_concept_id"], name: "index_connections_on_src_concept_id_and_dst_concept_id", unique: true
    t.index ["src_concept_id"], name: "index_connections_on_src_concept_id"
    t.index ["user_id"], name: "index_connections_on_user_id"
  end

  create_table "dismissed_concept_notes", force: :cascade do |t|
    t.bigint "concept_id", null: false
    t.bigint "note_id", null: false
    t.datetime "dismissed_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_id", "note_id"], name: "index_dismissed_concept_notes_on_concept_id_and_note_id", unique: true
    t.index ["concept_id"], name: "index_dismissed_concept_notes_on_concept_id"
    t.index ["note_id"], name: "index_dismissed_concept_notes_on_note_id"
  end

  create_table "domains", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "parent_id"
    t.boolean "is_default", default: false
    t.boolean "system_generated", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_domains_on_name", unique: true
    t.index ["parent_id"], name: "index_domains_on_parent_id"
  end

  create_table "good_job_batches", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "description"
    t.jsonb "serialized_properties"
    t.text "on_finish"
    t.text "on_success"
    t.text "on_discard"
    t.text "callback_queue_name"
    t.integer "callback_priority"
    t.datetime "enqueued_at"
    t.datetime "discarded_at"
    t.datetime "finished_at"
    t.datetime "jobs_finished_at"
  end

  create_table "good_job_executions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "active_job_id", null: false
    t.text "job_class"
    t.text "queue_name"
    t.jsonb "serialized_params"
    t.datetime "scheduled_at"
    t.datetime "finished_at"
    t.text "error"
    t.integer "error_event", limit: 2
    t.text "error_backtrace", array: true
    t.uuid "process_id"
    t.interval "duration"
    t.index ["active_job_id", "created_at"], name: "index_good_job_executions_on_active_job_id_and_created_at"
    t.index ["process_id", "created_at"], name: "index_good_job_executions_on_process_id_and_created_at"
  end

  create_table "good_job_processes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "state"
    t.integer "lock_type", limit: 2
  end

  create_table "good_job_settings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "key"
    t.jsonb "value"
    t.index ["key"], name: "index_good_job_settings_on_key", unique: true
  end

  create_table "good_jobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "queue_name"
    t.integer "priority"
    t.jsonb "serialized_params"
    t.datetime "scheduled_at"
    t.datetime "performed_at"
    t.datetime "finished_at"
    t.text "error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "active_job_id"
    t.text "concurrency_key"
    t.text "cron_key"
    t.uuid "retried_good_job_id"
    t.datetime "cron_at"
    t.uuid "batch_id"
    t.uuid "batch_callback_id"
    t.boolean "is_discrete"
    t.integer "executions_count"
    t.text "job_class"
    t.integer "error_event", limit: 2
    t.text "labels", array: true
    t.uuid "locked_by_id"
    t.datetime "locked_at"
    t.index ["active_job_id", "created_at"], name: "index_good_jobs_on_active_job_id_and_created_at"
    t.index ["batch_callback_id"], name: "index_good_jobs_on_batch_callback_id", where: "(batch_callback_id IS NOT NULL)"
    t.index ["batch_id"], name: "index_good_jobs_on_batch_id", where: "(batch_id IS NOT NULL)"
    t.index ["concurrency_key", "created_at"], name: "index_good_jobs_on_concurrency_key_and_created_at"
    t.index ["concurrency_key"], name: "index_good_jobs_on_concurrency_key_when_unfinished", where: "(finished_at IS NULL)"
    t.index ["cron_key", "created_at"], name: "index_good_jobs_on_cron_key_and_created_at_cond", where: "(cron_key IS NOT NULL)"
    t.index ["cron_key", "cron_at"], name: "index_good_jobs_on_cron_key_and_cron_at_cond", unique: true, where: "(cron_key IS NOT NULL)"
    t.index ["finished_at"], name: "index_good_jobs_jobs_on_finished_at_only", where: "(finished_at IS NOT NULL)"
    t.index ["job_class"], name: "index_good_jobs_on_job_class"
    t.index ["labels"], name: "index_good_jobs_on_labels", where: "(labels IS NOT NULL)", using: :gin
    t.index ["locked_by_id"], name: "index_good_jobs_on_locked_by_id", where: "(locked_by_id IS NOT NULL)"
    t.index ["priority", "created_at"], name: "index_good_job_jobs_for_candidate_lookup", where: "(finished_at IS NULL)"
    t.index ["priority", "created_at"], name: "index_good_jobs_jobs_on_priority_created_at_when_unfinished", order: { priority: "DESC NULLS LAST" }, where: "(finished_at IS NULL)"
    t.index ["priority", "scheduled_at"], name: "index_good_jobs_on_priority_scheduled_at_unfinished_unlocked", where: "((finished_at IS NULL) AND (locked_by_id IS NULL))"
    t.index ["queue_name", "scheduled_at"], name: "index_good_jobs_on_queue_name_and_scheduled_at", where: "(finished_at IS NULL)"
    t.index ["scheduled_at"], name: "index_good_jobs_on_scheduled_at", where: "(finished_at IS NULL)"
  end

  create_table "highlight_colors", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "label"
    t.string "color_hex"
    t.integer "position"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_highlight_colors_on_user_id"
  end

  create_table "highlights", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "source_id", null: false
    t.integer "page_number"
    t.text "text_content"
    t.string "color_hex"
    t.jsonb "bounds"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "note_id"
    t.jsonb "cited_source_ids"
    t.index ["note_id"], name: "index_highlights_on_note_id"
    t.index ["source_id"], name: "index_highlights_on_source_id"
    t.index ["user_id"], name: "index_highlights_on_user_id"
  end

  create_table "linkings", force: :cascade do |t|
    t.bigint "link_id", null: false
    t.string "linkable_type", null: false
    t.bigint "linkable_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["link_id"], name: "index_linkings_on_link_id"
    t.index ["linkable_type", "linkable_id", "link_id"], name: "index_linkings_uniqueness", unique: true
    t.index ["linkable_type", "linkable_id"], name: "index_linkings_on_linkable"
  end

  create_table "links", force: :cascade do |t|
    t.string "name", null: false
    t.string "url", null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "note_links", force: :cascade do |t|
    t.bigint "note_id", null: false
    t.string "linked_type", null: false
    t.bigint "linked_id", null: false
    t.string "link_type"
    t.text "context"
    t.integer "relevance"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["link_type"], name: "index_note_links_on_link_type"
    t.index ["linked_type", "linked_id"], name: "index_note_links_on_linked"
    t.index ["linked_type", "linked_id"], name: "index_note_links_on_linked_type_and_linked_id"
    t.index ["note_id", "linked_type", "linked_id"], name: "index_note_links_on_note_id_and_linked_type_and_linked_id"
    t.index ["note_id"], name: "index_note_links_on_note_id"
  end

  create_table "note_sources", force: :cascade do |t|
    t.bigint "note_id", null: false
    t.bigint "source_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["note_id", "source_id"], name: "index_note_sources_on_note_id_and_source_id", unique: true
    t.index ["note_id"], name: "index_note_sources_on_note_id"
    t.index ["source_id"], name: "index_note_sources_on_source_id"
  end

  create_table "notes", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "concept_id"
    t.text "body", null: false
    t.string "note_type"
    t.text "context"
    t.text "tags", default: [], array: true
    t.boolean "pinned", default: false
    t.date "noted_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "title"
    t.bigint "source_id"
    t.integer "page_number"
    t.text "quote_text"
    t.jsonb "quote_bounds"
    t.index ["concept_id"], name: "index_notes_on_concept_id"
    t.index ["note_type"], name: "index_notes_on_note_type"
    t.index ["noted_on"], name: "index_notes_on_noted_on"
    t.index ["pinned"], name: "index_notes_on_pinned"
    t.index ["source_id"], name: "index_notes_on_source_id"
    t.index ["user_id"], name: "index_notes_on_user_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "kind", null: false
    t.jsonb "payload", default: {}, null: false
    t.string "status", default: "pending", null: false
    t.datetime "acted_at"
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["kind"], name: "index_notifications_on_kind"
    t.index ["user_id", "read_at"], name: "index_notifications_on_user_read"
    t.index ["user_id", "status", "created_at"], name: "index_notifications_on_user_status_created", order: { created_at: :desc }
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "passage_insight_unlocks", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "source_id", null: false
    t.datetime "granted_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source_id"], name: "index_passage_insight_unlocks_on_source_id"
    t.index ["user_id", "granted_at"], name: "index_passage_insight_unlocks_on_user_id_and_granted_at"
    t.index ["user_id", "source_id"], name: "index_passage_insight_unlocks_on_user_id_and_source_id", unique: true
    t.index ["user_id"], name: "index_passage_insight_unlocks_on_user_id"
  end

  create_table "people", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "full_name", null: false
    t.text "aka", default: [], array: true
    t.string "role"
    t.text "summary"
    t.jsonb "attrs", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "email"
    t.string "url"
    t.string "first_name"
    t.string "middle_name"
    t.string "last_name"
    t.string "orcid"
    t.jsonb "links", default: []
    t.datetime "enriched_at"
    t.text "affiliation"
    t.datetime "affiliation_as_of"
    t.index ["full_name"], name: "index_people_on_full_name"
    t.index ["orcid"], name: "index_people_on_orcid"
    t.index ["role"], name: "index_people_on_role"
    t.index ["user_id"], name: "index_people_on_user_id"
  end

  create_table "people_concepts", force: :cascade do |t|
    t.bigint "person_id", null: false
    t.bigint "concept_id", null: false
    t.string "rel_type"
    t.text "notes"
    t.integer "strength"
    t.decimal "confidence"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_id"], name: "index_people_concepts_on_concept_id"
    t.index ["person_id", "concept_id"], name: "index_people_concepts_on_person_id_and_concept_id", unique: true
    t.index ["person_id"], name: "index_people_concepts_on_person_id"
    t.index ["rel_type"], name: "index_people_concepts_on_rel_type"
  end

  create_table "people_notes", force: :cascade do |t|
    t.bigint "person_id", null: false
    t.bigint "note_id", null: false
    t.string "rel_type"
    t.text "context"
    t.integer "prominence"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["note_id"], name: "index_people_notes_on_note_id"
    t.index ["person_id", "note_id"], name: "index_people_notes_on_person_id_and_note_id"
    t.index ["person_id"], name: "index_people_notes_on_person_id"
    t.index ["rel_type"], name: "index_people_notes_on_rel_type"
  end

  create_table "people_sources", force: :cascade do |t|
    t.bigint "person_id", null: false
    t.bigint "source_id", null: false
    t.string "role"
    t.text "notes"
    t.decimal "confidence"
    t.text "tags", default: [], array: true
    t.date "last_reviewed_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["person_id", "source_id"], name: "index_people_sources_on_person_id_and_source_id", unique: true
    t.index ["person_id"], name: "index_people_sources_on_person_id"
    t.index ["role"], name: "index_people_sources_on_role"
    t.index ["source_id"], name: "index_people_sources_on_source_id"
  end

  create_table "shares", force: :cascade do |t|
    t.bigint "owner_id", null: false
    t.bigint "recipient_id"
    t.string "shareable_type", null: false
    t.bigint "shareable_id", null: false
    t.string "permission", default: "viewer", null: false
    t.string "invited_email"
    t.string "invite_token"
    t.datetime "invite_sent_at"
    t.datetime "invite_accepted_at"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "include_source_notes", default: false, null: false
    t.index ["invite_token"], name: "index_shares_on_invite_token", unique: true, where: "(invite_token IS NOT NULL)"
    t.index ["invited_email"], name: "index_shares_on_invited_email"
    t.index ["owner_id"], name: "index_shares_on_owner_id"
    t.index ["recipient_id"], name: "index_shares_on_recipient_id"
    t.index ["shareable_type", "shareable_id"], name: "index_shares_on_shareable_type_and_shareable_id"
  end

  create_table "source_authors", force: :cascade do |t|
    t.bigint "source_id", null: false
    t.bigint "author_id", null: false
    t.integer "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_source_authors_on_author_id"
    t.index ["source_id", "author_id"], name: "index_source_authors_on_source_id_and_author_id", unique: true
    t.index ["source_id", "position"], name: "index_source_authors_on_source_id_and_position"
    t.index ["source_id"], name: "index_source_authors_on_source_id"
  end

  create_table "source_statistical_tests", force: :cascade do |t|
    t.bigint "source_id", null: false
    t.bigint "statistical_test_id", null: false
    t.float "confidence"
    t.boolean "detected_automatically", default: false, null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source_id", "statistical_test_id"], name: "index_source_stat_tests_on_pair", unique: true
    t.index ["source_id"], name: "index_source_statistical_tests_on_source_id"
    t.index ["statistical_test_id"], name: "index_source_statistical_tests_on_statistical_test_id"
  end

  create_table "sources", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "title", null: false
    t.string "authors"
    t.integer "year"
    t.string "kind"
    t.string "publisher_or_venue"
    t.string "doi"
    t.text "citation"
    t.text "summary"
    t.text "tags", default: [], array: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.string "journal_name"
    t.string "volume"
    t.string "issue"
    t.string "pages"
    t.date "publication_date"
    t.text "abstract"
    t.string "book_title"
    t.string "edition"
    t.string "isbn"
    t.integer "chapter_number"
    t.string "website_name"
    t.date "access_date"
    t.json "keywords", default: []
    t.json "raw_metadata"
    t.text "formatted_citation"
    t.json "methodologies"
    t.text "markers", default: [], null: false, array: true
    t.datetime "statistical_tests_searched_at"
    t.index ["doi"], name: "index_sources_on_doi", unique: true, where: "(doi IS NOT NULL)"
    t.index ["kind"], name: "index_sources_on_kind"
    t.index ["markers"], name: "index_sources_on_markers", using: :gin
    t.index ["user_id"], name: "index_sources_on_user_id"
    t.index ["year"], name: "index_sources_on_year"
  end

  create_table "statistical_tests", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.text "description"
    t.json "aliases", default: []
    t.integer "position", default: 0, null: false
    t.json "goal", default: []
    t.string "variable_relationship_structure"
    t.string "primary_variable_1_type"
    t.string "primary_variable_2_type"
    t.string "number_of_dependent_variables"
    t.string "number_of_predictors"
    t.string "number_of_groups_conditions"
    t.string "sample_relationship"
    t.string "repeated_observations_present"
    t.string "number_of_timepoints"
    t.string "time_matters_to_analysis"
    t.string "covariates_included"
    t.string "nested_or_clustered_data"
    t.string "data_hierarchy"
    t.string "mediation"
    t.string "moderation"
    t.string "parametric_assumptions_reasonably_met"
    t.string "outcome_approximately_normal"
    t.string "equal_variances_assumed"
    t.string "small_sample_concern"
    t.string "small_expected_cell_counts"
    t.string "overdispersion_present"
    t.string "many_zero_values"
    t.string "censoring_present"
    t.string "latent_construct_interest"
    t.string "dimension_reduction_goal"
    t.string "group_membership_known_in_advance"
    t.string "agreement_data_type"
    t.string "post_hoc_comparisons_needed"
    t.string "analysis_scope"
    t.json "primary_output_desired", default: []
    t.string "exact_method_needed"
    t.string "bayesian_approach_desired"
    t.string "analysis_preference_level"
    t.string "complexity_level_allowed"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_statistical_tests_on_name", unique: true
    t.index ["position"], name: "index_statistical_tests_on_position"
    t.index ["slug"], name: "index_statistical_tests_on_slug", unique: true
  end

  create_table "subscriptions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "provider", null: false
    t.string "external_id", null: false
    t.string "external_customer_id"
    t.string "status", null: false
    t.string "interval", null: false
    t.integer "amount_cents"
    t.string "currency", default: "usd"
    t.datetime "current_period_end"
    t.boolean "cancel_at_period_end", default: false, null: false
    t.datetime "canceled_at"
    t.text "cancellation_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "tier"
    t.index ["provider", "external_id"], name: "index_subscriptions_on_provider_and_external_id", unique: true
    t.index ["status"], name: "index_subscriptions_on_status"
    t.index ["user_id", "status"], name: "index_subscriptions_on_user_id_and_status"
    t.index ["user_id"], name: "index_subscriptions_on_user_id"
  end

  create_table "tabletop_items", force: :cascade do |t|
    t.bigint "tabletop_id", null: false
    t.string "kind", null: false
    t.string "item_type"
    t.bigint "item_id"
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.float "width"
    t.float "height"
    t.float "rotation", default: 0.0, null: false
    t.integer "z_index", default: 0, null: false
    t.text "body"
    t.float "start_x"
    t.float "start_y"
    t.float "end_x"
    t.float "end_y"
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "staged", default: false, null: false
    t.integer "start_anchor_id"
    t.integer "end_anchor_id"
    t.string "start_anchor_side"
    t.string "end_anchor_side"
    t.index ["end_anchor_id"], name: "index_tabletop_items_on_end_anchor_id"
    t.index ["item_type", "item_id"], name: "index_tabletop_items_on_item"
    t.index ["start_anchor_id"], name: "index_tabletop_items_on_start_anchor_id"
    t.index ["tabletop_id", "staged"], name: "index_tabletop_items_on_tabletop_id_and_staged"
    t.index ["tabletop_id", "z_index"], name: "index_tabletop_items_on_tabletop_id_and_z_index"
    t.index ["tabletop_id"], name: "index_tabletop_items_on_tabletop_id"
  end

  create_table "tabletops", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.text "description"
    t.float "view_x", default: 0.0
    t.float "view_y", default: 0.0
    t.float "view_zoom", default: 1.0
    t.datetime "last_opened_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "last_opened_at"], name: "index_tabletops_on_user_id_and_last_opened_at"
    t.index ["user_id"], name: "index_tabletops_on_user_id"
  end

  create_table "taggings", force: :cascade do |t|
    t.bigint "tag_id", null: false
    t.string "taggable_type", null: false
    t.bigint "taggable_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tag_id", "taggable_type", "taggable_id"], name: "index_taggings_uniqueness", unique: true
    t.index ["tag_id"], name: "index_taggings_on_tag_id"
    t.index ["taggable_type", "taggable_id"], name: "index_taggings_on_taggable"
    t.index ["taggable_type", "taggable_id"], name: "index_taggings_on_taggable_type_and_taggable_id"
  end

  create_table "tags", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tags_on_name"
    t.index ["user_id", "slug"], name: "index_tags_on_user_id_and_slug", unique: true
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "upload_batch_items", force: :cascade do |t|
    t.bigint "upload_batch_id", null: false
    t.bigint "source_id"
    t.string "status", default: "pending", null: false
    t.string "original_filename"
    t.bigint "file_size"
    t.jsonb "extracted_metadata", default: {}
    t.string "extracted_doi"
    t.string "extraction_method"
    t.jsonb "detected_authors", default: []
    t.jsonb "detected_concepts", default: []
    t.jsonb "duplicate_candidates", default: []
    t.jsonb "user_decisions", default: {}
    t.text "error_message"
    t.integer "retry_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["extracted_doi"], name: "index_upload_batch_items_on_extracted_doi"
    t.index ["source_id"], name: "index_upload_batch_items_on_source_id"
    t.index ["status"], name: "index_upload_batch_items_on_status"
    t.index ["upload_batch_id", "status"], name: "index_upload_batch_items_on_upload_batch_id_and_status"
    t.index ["upload_batch_id"], name: "index_upload_batch_items_on_upload_batch_id"
  end

  create_table "upload_batches", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name"
    t.string "status", default: "pending", null: false
    t.integer "total_count", default: 0
    t.integer "completed_count", default: 0
    t.integer "failed_count", default: 0
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_upload_batches_on_status"
    t.index ["user_id", "status"], name: "index_upload_batches_on_user_id_and_status"
    t.index ["user_id"], name: "index_upload_batches_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "admin", default: false, null: false
    t.string "plan", default: "free", null: false
    t.datetime "plan_through"
    t.datetime "source_count_grace_until"
    t.string "stripe_customer_id"
    t.integer "concept_generations_used", default: 0, null: false
    t.datetime "concept_generations_reset_at"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["plan"], name: "index_users_on_plan"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "allowed_domains", "users", column: "added_by_id"
  add_foreign_key "authors", "users"
  add_foreign_key "bibliography_entries", "collections"
  add_foreign_key "bibliography_entries", "sources"
  add_foreign_key "collection_groupings", "collections"
  add_foreign_key "collection_items", "collection_groupings", column: "grouping_id", on_delete: :nullify
  add_foreign_key "collection_items", "collections"
  add_foreign_key "collection_items", "users", column: "added_by_id"
  add_foreign_key "collections", "users"
  add_foreign_key "concept_definition_domains", "concept_definitions"
  add_foreign_key "concept_definition_domains", "domains"
  add_foreign_key "concept_disambiguations", "concepts", column: "concept_a_id", on_delete: :cascade
  add_foreign_key "concept_disambiguations", "concepts", column: "concept_b_id", on_delete: :cascade
  add_foreign_key "concept_disambiguations", "users"
  add_foreign_key "concept_domains", "concepts"
  add_foreign_key "concept_domains", "domains"
  add_foreign_key "concept_generation_batches", "users"
  add_foreign_key "concept_generations", "concept_definitions", column: "approved_concept_definition_id"
  add_foreign_key "concept_generations", "concept_definitions", column: "target_concept_definition_id"
  add_foreign_key "concept_generations", "concept_generation_batches"
  add_foreign_key "concept_notes", "concepts"
  add_foreign_key "concept_notes", "notes"
  add_foreign_key "concept_sources", "concepts"
  add_foreign_key "concept_sources", "sources"
  add_foreign_key "concepts", "concept_definitions", column: "definition_id"
  add_foreign_key "concepts", "users"
  add_foreign_key "connections", "concepts", column: "dst_concept_id"
  add_foreign_key "connections", "concepts", column: "src_concept_id"
  add_foreign_key "connections", "users"
  add_foreign_key "dismissed_concept_notes", "concepts", on_delete: :cascade
  add_foreign_key "dismissed_concept_notes", "notes", on_delete: :cascade
  add_foreign_key "domains", "domains", column: "parent_id"
  add_foreign_key "highlight_colors", "users"
  add_foreign_key "highlights", "notes"
  add_foreign_key "highlights", "sources"
  add_foreign_key "highlights", "users"
  add_foreign_key "linkings", "links"
  add_foreign_key "note_links", "notes"
  add_foreign_key "note_sources", "notes", on_delete: :cascade
  add_foreign_key "note_sources", "sources", on_delete: :cascade
  add_foreign_key "notes", "concepts"
  add_foreign_key "notes", "sources"
  add_foreign_key "notes", "users"
  add_foreign_key "notifications", "users"
  add_foreign_key "passage_insight_unlocks", "sources", on_delete: :cascade
  add_foreign_key "passage_insight_unlocks", "users", on_delete: :cascade
  add_foreign_key "people", "users"
  add_foreign_key "people_concepts", "concepts"
  add_foreign_key "people_concepts", "people"
  add_foreign_key "people_notes", "notes"
  add_foreign_key "people_notes", "people"
  add_foreign_key "people_sources", "people"
  add_foreign_key "people_sources", "sources"
  add_foreign_key "shares", "users", column: "owner_id"
  add_foreign_key "shares", "users", column: "recipient_id"
  add_foreign_key "source_authors", "authors"
  add_foreign_key "source_authors", "sources"
  add_foreign_key "source_statistical_tests", "sources"
  add_foreign_key "source_statistical_tests", "statistical_tests"
  add_foreign_key "sources", "users"
  add_foreign_key "subscriptions", "users"
  add_foreign_key "tabletop_items", "tabletops"
  add_foreign_key "tabletops", "users"
  add_foreign_key "taggings", "tags"
  add_foreign_key "tags", "users"
  add_foreign_key "upload_batch_items", "sources"
  add_foreign_key "upload_batch_items", "upload_batches"
  add_foreign_key "upload_batches", "users"
end
