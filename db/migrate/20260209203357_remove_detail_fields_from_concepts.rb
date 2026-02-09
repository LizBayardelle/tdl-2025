class RemoveDetailFieldsFromConcepts < ActiveRecord::Migration[7.2]
  def change
    remove_column :concepts, :mechanisms, :text, default: [], array: true
    remove_column :concepts, :signature_techniques, :text, default: [], array: true
    remove_column :concepts, :strengths, :text, default: [], array: true
    remove_column :concepts, :weaknesses, :text, default: [], array: true
    remove_column :concepts, :adjacent_models, :text, default: [], array: true
    remove_column :concepts, :contrasts_with, :text, default: [], array: true
    remove_column :concepts, :integrates_with, :text, default: [], array: true
    remove_column :concepts, :intake_questions, :text, default: [], array: true
    remove_column :concepts, :micro_skills, :text, default: [], array: true
    remove_column :concepts, :practice_prompts, :text, default: [], array: true
    remove_column :concepts, :assessment_links, :text, default: [], array: true
    remove_column :concepts, :evidence_brief, :text
    remove_column :concepts, :confidence_note, :text
  end
end
