# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# === Domains ===
domain_tree = {
  "General" => { is_default: true, children: [] },
  "Medicine" => {
    children: [
      "General Anatomy", "Neuroanatomy", "Neurophysiology", "Physiology",
      "Pathology", "Pharmacology", "Psychiatry", "Epidemiology", "Genetics"
    ]
  },
  "Psychology" => {
    children: [
      "Clinical Psychology", "Cognitive Psychology", "Social Psychology",
      "Developmental Psychology", "Neuropsychology", "Personality Psychology",
      "Behavioral Psychology", "Evolutionary Psychology", "Health Psychology",
      "Forensic Psychology", "Psychotherapy"
    ]
  },
  "Research" => {
    children: ["Research Methods", "Statistics", "Psychometrics"]
  }
}

domain_tree.each do |parent_name, config|
  parent = Domain.find_or_create_by!(name: parent_name) do |d|
    d.is_default = config[:is_default] || false
    d.system_generated = false
  end

  (config[:children] || []).each do |child_name|
    Domain.find_or_create_by!(name: child_name) do |d|
      d.parent = parent
      d.system_generated = false
    end
  end
end

puts "Seeded #{Domain.count} domains"
