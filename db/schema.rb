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

ActiveRecord::Schema[7.2].define(version: 2025_12_27_190122) do
  # These are extensions that must be enabled in order to support this database
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
    t.string "node_type", null: false
    t.string "label", null: false
    t.string "slug", null: false
    t.text "summary_top"
    t.text "summary_mid"
    t.text "summary_deep"
    t.text "mechanisms", default: [], array: true
    t.text "signature_techniques", default: [], array: true
    t.text "strengths", default: [], array: true
    t.text "weaknesses", default: [], array: true
    t.text "adjacent_models", default: [], array: true
    t.text "contrasts_with", default: [], array: true
    t.text "integrates_with", default: [], array: true
    t.text "intake_questions", default: [], array: true
    t.text "micro_skills", default: [], array: true
    t.text "practice_prompts", default: [], array: true
    t.text "assessment_links", default: [], array: true
    t.text "evidence_brief"
    t.text "confidence_note"
    t.text "tags", default: [], array: true
    t.string "level_status"
    t.date "last_reviewed_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["level_status"], name: "index_concepts_on_level_status"
    t.index ["node_type"], name: "index_concepts_on_node_type"
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
    t.index ["source_id"], name: "index_highlights_on_source_id"
    t.index ["user_id"], name: "index_highlights_on_user_id"
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
    t.index ["concept_id"], name: "index_notes_on_concept_id"
    t.index ["note_type"], name: "index_notes_on_note_type"
    t.index ["noted_on"], name: "index_notes_on_noted_on"
    t.index ["pinned"], name: "index_notes_on_pinned"
    t.index ["source_id"], name: "index_notes_on_source_id"
    t.index ["user_id"], name: "index_notes_on_user_id"
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
    t.index ["full_name"], name: "index_people_on_full_name"
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
    t.index ["doi"], name: "index_sources_on_doi", unique: true, where: "(doi IS NOT NULL)"
    t.index ["kind"], name: "index_sources_on_kind"
    t.index ["user_id"], name: "index_sources_on_user_id"
    t.index ["year"], name: "index_sources_on_year"
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
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tags_on_name"
    t.index ["user_id", "slug"], name: "index_tags_on_user_id_and_slug", unique: true
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "authors", "users"
  add_foreign_key "concept_notes", "concepts"
  add_foreign_key "concept_notes", "notes"
  add_foreign_key "concept_sources", "concepts"
  add_foreign_key "concept_sources", "sources"
  add_foreign_key "concepts", "users"
  add_foreign_key "connections", "concepts", column: "dst_concept_id"
  add_foreign_key "connections", "concepts", column: "src_concept_id"
  add_foreign_key "connections", "users"
  add_foreign_key "highlight_colors", "users"
  add_foreign_key "highlights", "sources"
  add_foreign_key "highlights", "users"
  add_foreign_key "note_links", "notes"
  add_foreign_key "notes", "concepts"
  add_foreign_key "notes", "sources"
  add_foreign_key "notes", "users"
  add_foreign_key "people", "users"
  add_foreign_key "people_concepts", "concepts"
  add_foreign_key "people_concepts", "people"
  add_foreign_key "people_notes", "notes"
  add_foreign_key "people_notes", "people"
  add_foreign_key "people_sources", "people"
  add_foreign_key "people_sources", "sources"
  add_foreign_key "source_authors", "authors"
  add_foreign_key "source_authors", "sources"
  add_foreign_key "sources", "users"
  add_foreign_key "taggings", "tags"
  add_foreign_key "tags", "users"
end
