class CreateNodes < ActiveRecord::Migration[7.2]
  def change
    create_table :nodes do |t|
      t.references :user, null: false, foreign_key: true

      # Core identification
      t.string :node_type, null: false # model, technique, mechanism, construct, measure, population
      t.string :label, null: false
      t.string :slug, null: false

      # Three-level mastery summaries
      t.text :summary_top # 2-3 sentences
      t.text :summary_mid # ~200 words
      t.text :summary_deep # ~600 words

      # Array fields for structured content
      t.text :mechanisms, array: true, default: []
      t.text :signature_techniques, array: true, default: []
      t.text :strengths, array: true, default: []
      t.text :weaknesses, array: true, default: []
      t.text :adjacent_models, array: true, default: []
      t.text :contrasts_with, array: true, default: []
      t.text :integrates_with, array: true, default: []
      t.text :intake_questions, array: true, default: []
      t.text :micro_skills, array: true, default: []
      t.text :practice_prompts, array: true, default: []
      t.text :assessment_links, array: true, default: []

      # Evidence and reflection
      t.text :evidence_brief
      t.text :confidence_note

      # Organization
      t.text :tags, array: true, default: []
      t.string :level_status # mapped, basic, deep
      t.date :last_reviewed_on

      t.timestamps
    end

    add_index :nodes, :slug, unique: true
    add_index :nodes, :node_type
    add_index :nodes, :level_status
  end
end
