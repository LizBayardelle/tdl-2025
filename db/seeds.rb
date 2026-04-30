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

# === Allowed Domains (for AI concept generation web search) ===
allowed_domains = [
  { domain: 'wikipedia.org',            category: 'reference',     notes: 'General reference with source citations' },
  { domain: 'nih.gov',                  category: 'medical',       notes: 'National Institutes of Health — umbrella' },
  { domain: 'ncbi.nlm.nih.gov',         category: 'research',      notes: 'PubMed/NCBI — peer-reviewed biomedical literature' },
  { domain: 'pubmed.ncbi.nlm.nih.gov',  category: 'research',      notes: 'PubMed direct' },
  { domain: 'mayoclinic.org',           category: 'medical',       notes: 'Mayo Clinic clinical summaries' },
  { domain: 'my.clevelandclinic.org',   category: 'medical',       notes: 'Cleveland Clinic patient/clinical resources' },
  { domain: 'sciencedirect.com',        category: 'research',      notes: 'Elsevier — peer-reviewed journals' },
  { domain: 'nimh.nih.gov',             category: 'mental_health', notes: 'National Institute of Mental Health' },
  { domain: 'psychiatry.org',           category: 'mental_health', notes: 'American Psychiatric Association (APA)' },
  { domain: 'who.int',                  category: 'medical',       notes: 'World Health Organization' },
  { domain: 'mentalhealth.va.gov',      category: 'mental_health', notes: 'US VA mental health' },
  { domain: 'apa.org',                  category: 'mental_health', notes: 'American Psychological Association' },
  { domain: 'merriam-webster.com',      category: 'reference',     notes: 'Etymology lookups' },
  { domain: 'adaa.org',                 category: 'mental_health', notes: 'Anxiety and Depression Association of America' },
  { domain: 'samhsa.gov',               category: 'mental_health', notes: 'Substance Abuse & Mental Health Services Administration' },
  { domain: 'health.harvard.edu',       category: 'medical',       notes: 'Harvard Health Publishing' },
  { domain: 'psychologytoday.com',      category: 'mental_health', notes: 'Psychology Today (mixed quality; useful for overview articles)' },
  { domain: 'ninds.nih.gov',            category: 'medical',       notes: 'NIH National Institute of Neurological Disorders and Stroke' },
  { domain: 'nia.nih.gov',              category: 'medical',       notes: 'NIH National Institute on Aging' }
]

allowed_domains.each do |attrs|
  AllowedDomain.find_or_create_by!(domain: attrs[:domain]) do |d|
    d.category = attrs[:category]
    d.notes = attrs[:notes]
    d.active = true
  end
end

puts "Seeded #{AllowedDomain.count} allowed domains"

# === Statistical Tests Catalog ===
load Rails.root.join('db/seeds/statistical_tests.rb')
