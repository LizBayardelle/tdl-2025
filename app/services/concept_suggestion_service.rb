require 'net/http'
require 'json'

class ConceptSuggestionService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  VALID_CONCEPT_TYPES = ConceptDefinition::CONCEPT_TYPES

  def initialize(title:, abstract: nil, keywords: nil, user_concepts: nil)
    @title = title
    @abstract = abstract
    @keywords = keywords || []
    @user_concepts = user_concepts || [] # Array of {id, label, concept_type}
  end

  def suggest
    return [] if @title.blank?
    return [] unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic_api
    parse_response(response)
  rescue => e
    Rails.logger.error "ConceptSuggestionService error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  private

  def call_anthropic_api
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 30

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: build_prompt
        }
      ]
    }.to_json

    http.request(request)
  end

  def build_prompt
    keywords_text = @keywords.any? ? @keywords.join(', ') : 'None provided'

    # Build user concepts context if available
    user_concepts_text = if @user_concepts.any?
      concept_list = @user_concepts.first(50).map { |c| "- #{c[:label]} (#{c[:concept_type] || 'untyped'})" }.join("\n")
      <<~CONCEPTS

      USER'S EXISTING CONCEPTS (match these when applicable):
      #{concept_list}
      CONCEPTS
    else
      ''
    end

    <<~PROMPT
      You are an academic research assistant. Analyze this article metadata and identify 5-8 key academic concepts.

      Title: #{@title}
      Abstract: #{@abstract || 'None provided'}
      Keywords: #{keywords_text}
      #{user_concepts_text}
      For each concept, provide:
      - label: Concept name (title case, typically 2-4 words)
      - concept_type: One of [#{VALID_CONCEPT_TYPES.join(', ')}]
      - confidence: One of [high, medium, low]
      - rationale: Brief (10-15 words) explanation
      - existing_match_id: If this matches one of the user's existing concepts above, include its label exactly as shown. Otherwise omit this field.

      IMPORTANT RULES:
      - Prefer matching to existing user concepts when the meaning is the same, even if wording differs slightly.
      - Only extract ACADEMIC CONCEPTS - theories, phenomena, constructs, methods, etc.
      - DO NOT include: author names, journal names, volume/issue numbers, dates, DOIs, page numbers, or sentence fragments.
      - Each concept should be a standalone noun phrase (2-5 words), not a sentence or clause.

      Classification decision tree for concept_type (apply in order, first match wins):
      1. research_method — A procedure or formal technique used to generate, analyze, or interpret data
      2. measurement — Exists specifically and primarily to quantify an attribute of something else
      3. intervention — Primary purpose is to treat, manage, or prevent a pathology in a clinical/therapeutic context
      4. pathology — A deviation from normal functioning in a biological or psychological system
      5. emotion — A discrete, evolved affective response to a stimulus
      6. symptom — A non-emotional observable/self-reportable manifestation caused by a pathology
      7. school_of_thought — A named intellectual tradition that systematically organizes how a field approaches its questions
      8. physical_entity — Has mass, occupies space, can be physically located or interacted with
      9. physical_process — A change occurring in physical matter detectable by instrumentation
      10. non_physical_process — A functional transformation in a system with no directly detectable physical signal
      11. non_physical_concept — Default. Everything else.

      Return ONLY a valid JSON array with no additional text or markdown formatting.
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "ConceptSuggestionService API failed: #{response.code}"
      return []
    end

    result = JSON.parse(response.body)
    text_content = result.dig('content', 0, 'text')

    return [] if text_content.blank?

    Rails.logger.info "ConceptSuggestionService response received, parsing..."

    # Extract JSON from response
    json_text = text_content.strip

    # If wrapped in markdown code blocks, extract content
    if json_text.match?(/```/)
      json_match = json_text.match(/```(?:json)?\s*\n?(.*?)\n?```/m)
      json_text = json_match[1] if json_match
    end

    # Find the JSON array
    json_start = json_text.index('[')
    json_end = json_text.rindex(']')

    if json_start && json_end && json_end > json_start
      json_text = json_text[json_start..json_end]
    end

    suggestions = JSON.parse(json_text)

    # Validate and normalize suggestions
    suggestions.select { |s|
      valid_concept_label?(s['label'].to_s.strip)
    }.map do |suggestion|
      result = {
        'label' => suggestion['label'].to_s.strip,
        'concept_type' => normalize_concept_type(suggestion['concept_type']),
        'confidence' => normalize_confidence(suggestion['confidence']),
        'rationale' => suggestion['rationale'].to_s.strip
      }

      # Check if LLM suggested a match to existing concept
      if suggestion['existing_match_id'].present?
        match_label = suggestion['existing_match_id'].to_s.strip
        matched_concept = @user_concepts.find { |c| c[:label].downcase == match_label.downcase }
        if matched_concept
          result['matched_concept_id'] = matched_concept[:id]
          result['matched_concept_label'] = matched_concept[:label]
        end
      end

      result
    end
  rescue JSON::ParserError => e
    Rails.logger.error "ConceptSuggestionService JSON parse error: #{e.message}"
    []
  end

  def normalize_concept_type(concept_type)
    type = concept_type.to_s.downcase.strip
    VALID_CONCEPT_TYPES.include?(type) ? type : 'non_physical_concept'
  end

  def normalize_confidence(confidence)
    valid_levels = %w[high medium low]
    level = confidence.to_s.downcase.strip
    valid_levels.include?(level) ? level : 'medium'
  end

  def valid_concept_label?(label)
    return false if label.blank?

    label_lower = label.downcase.strip

    # Too short or too long
    return false if label_lower.length < 4 || label_lower.length > 80

    # Generic/invalid words
    invalid_words = %w[low high medium none null undefined na n/a unfortunately however therefore moreover furthermore additionally]
    return false if invalid_words.include?(label_lower)

    # Looks like a person's name (2-3 capitalized words, no common concept words)
    # e.g., "Hal Gregerson", "Ray Robinson"
    # Be very conservative - only reject if it REALLY looks like just a name
    if label.match?(/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/)
      # Extensive list of academic/concept indicator words
      concept_indicators = %w[
        theory model effect bias tendency syndrome phenomenon principle hypothesis framework
        approach method process system analysis strategy strategies support affect regulation
        emotion stress coping behavior behaviour learning memory attention perception cognition
        motivation performance anxiety depression disorder intervention treatment therapy
        development change adaptation response outcome variable factor influence relationship
        difference differences pattern mechanism skill competence capacity ability intelligence
        identity self personality trait state mood feeling attitude belief value goal
        incongruence congruence conflict resolution satisfaction engagement burnout exhaustion
        resilience vulnerability risk protective social emotional cognitive behavioral physical
        mental health psychological physiological biological neurological assessment measurement
        scale inventory questionnaire survey interview observation experiment study research
      ]
      unless concept_indicators.any? { |indicator| label_lower.include?(indicator) }
        Rails.logger.debug "Rejecting potential author name: #{label}"
        return false
      end
    end

    # Volume/issue patterns
    return false if label_lower.match?(/\bvol\.?\s*\d+/i)
    return false if label_lower.match?(/\bno\.?\s*\d+/i)
    return false if label_lower.match?(/\bissue\s*\d+/i)
    return false if label_lower.match?(/\bvolume\s*\d+/i)

    # DOI patterns
    return false if label_lower.match?(/\bdoi[:\s]/i)
    return false if label_lower.match?(/10\.\d{4,}\//)

    # Date patterns (month names, year ranges, page numbers)
    months = %w[january february march april may june july august september october november december]
    return false if months.any? { |month| label_lower.include?(month) } && label_lower.match?(/\d{4}/)

    # Page number patterns (e.g., "7-24", "123-456")
    return false if label_lower.match?(/^\d+[-–]\d+$/)
    return false if label_lower.match?(/\d+[-–]\d+\s*doi/i)

    # Sentence fragments (contains punctuation that indicates it's not a concept)
    return false if label.include?('.')  # Concepts shouldn't have periods (except abbreviations)
    return false if label.match?(/[,;:]/) && label.length > 40  # Long strings with punctuation

    # Starts with conjunctions or articles in a sentence-like way
    return false if label_lower.match?(/^(and|or|but|the|a|an|in|on|at|to|for|of|with)\s+.{20,}/i)

    true
  end
end
