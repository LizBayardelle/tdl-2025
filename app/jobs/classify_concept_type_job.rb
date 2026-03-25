# Automatically classify a concept's type using LLM
# Uses a decision tree approach - first matching type wins
class ClassifyConceptTypeJob < ApplicationJob
  queue_as :default

  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  # Decision tree questions - ordered from most specific to most general
  # First "yes" wins
  CLASSIFICATION_TREE = [
    { type: 'research_method', question: 'Is this a procedure or formal technique used to generate, analyze, or interpret data?' },
    { type: 'measurement', question: 'Does this exist specifically and primarily to quantify an attribute of something else?' },
    { type: 'intervention', question: 'Is the primary purpose to treat, manage, or prevent a pathology in a clinical/therapeutic context?' },
    { type: 'pathology', question: 'Is this a deviation from normal functioning in a biological or psychological system?' },
    { type: 'emotion', question: 'Is this a discrete, evolved affective response to a stimulus (a basic emotion)?' },
    { type: 'symptom', question: 'Is this a non-emotional observable or self-reportable manifestation caused by a pathology?' },
    { type: 'school_of_thought', question: 'Is this a named intellectual tradition that systematically organizes how a field approaches its questions?' },
    { type: 'physical_entity', question: 'Does this have mass, occupy space, and can be physically located or interacted with?' },
    { type: 'physical_process', question: 'Is this a change occurring in physical matter that is detectable by instrumentation?' },
    { type: 'non_physical_process', question: 'Is this a functional transformation in a system with no directly detectable physical signal?' }
  ].freeze

  def perform(concept_id)
    concept = Concept.find_by(id: concept_id)
    return unless concept
    return if concept.concept_type.present? # Already classified

    Rails.logger.info "Classifying concept type for: #{concept.label}"

    concept_type = classify(concept.label)

    if concept_type
      concept.update_column(:concept_type, concept_type)
      Rails.logger.info "Classified '#{concept.label}' as: #{concept_type}"
    end
  rescue => e
    Rails.logger.error "Failed to classify concept #{concept_id}: #{e.message}"
    # Don't raise - we don't want to retry classification failures
  end

  private

  def classify(label)
    return 'non_physical_concept' unless ENV['ANTHROPIC_API_KEY'].present?

    prompt = build_prompt(label)
    response = call_api(prompt)

    return 'non_physical_concept' unless response

    parse_response(response)
  end

  def build_prompt(label)
    questions = CLASSIFICATION_TREE.map.with_index do |item, idx|
      "#{idx + 1}. #{item[:question]}"
    end.join("\n")

    <<~PROMPT
      You are classifying an academic concept. Evaluate EACH question IN ORDER and be CONSERVATIVE - only answer "yes" if the concept CLEARLY fits that category.

      Concept: "#{label}"

      Questions (answer each with yes/no, stop at first "yes"):
      #{questions}

      Return ONLY a single number (1-10) for the first "yes", or "11" if all answers are "no".
      Do not explain. Just the number.
    PROMPT
  end

  def call_api(prompt)
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 15

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    }.to_json

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      JSON.parse(response.body)
    else
      Rails.logger.error "Classification API failed: #{response.code}"
      nil
    end
  end

  def parse_response(response)
    text = response.dig('content', 0, 'text')&.strip
    return 'non_physical_concept' unless text

    # Extract number from response
    number = text.match(/(\d+)/)&.captures&.first&.to_i
    return 'non_physical_concept' unless number

    if number >= 1 && number <= CLASSIFICATION_TREE.length
      CLASSIFICATION_TREE[number - 1][:type]
    else
      'non_physical_concept'
    end
  end
end
