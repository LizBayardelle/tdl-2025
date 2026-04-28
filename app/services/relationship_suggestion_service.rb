require 'net/http'
require 'json'

# Calls Claude Haiku to propose relationships between a focal concept and
# candidate concepts already in the user's library.  Uses tool use for
# strict structured output.  Cheap by design — Haiku, conservative prompt,
# capped candidate list, max_tokens 1024.
class RelationshipSuggestionService
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'

  # Subset of the InlineRelTypeSelect categories that make sense for AI to
  # propose.  Drops anatomical positional types (which need spatial truth
  # the model can't reliably infer) — the user can add those manually.
  SUGGESTABLE_REL_TYPES = %w[
    parent_of child_of is_a categorizes
    prerequisite_for builds_on derived_from influenced
    related_to contrasts_with integrates_with associated_with
    supports critiques
    applies_to treats
  ].freeze

  REL_TYPE_HINTS = {
    'parent_of'         => 'focal contains, categorizes, or is the parent of target',
    'child_of'          => 'focal is contained by, categorized by, or is a child of target',
    'is_a'              => 'focal is an instance or specific type of target',
    'categorizes'       => 'focal is the category that target falls under',
    'prerequisite_for'  => 'focal must be understood before target',
    'builds_on'         => 'focal builds upon target',
    'derived_from'      => 'focal is derived from or originates from target',
    'influenced'        => 'focal influenced the development of target',
    'related_to'        => 'focal is generally related to target (use sparingly when no stronger relation fits)',
    'contrasts_with'    => 'focal contrasts with or opposes target',
    'integrates_with'   => 'focal integrates with target',
    'associated_with'   => 'focal is associated with target empirically',
    'supports'          => 'focal supports or provides evidence for target',
    'critiques'         => 'focal critiques or argues against target',
    'applies_to'        => 'focal applies to or is used in the context of target',
    'treats'            => 'focal is a treatment for target (clinical)',
  }.freeze

  Result = Struct.new(:target_id, :rel_type, :reasoning, keyword_init: true)

  def initialize(concept:, candidates:)
    @concept = concept
    @candidates = candidates
  end

  def suggest
    return [] unless ENV['ANTHROPIC_API_KEY'].present?
    return [] if @candidates.empty?
    return [] if @concept.label.blank?

    response = call_anthropic
    parse_tool_use(response)
  rescue => e
    Rails.logger.error "RelationshipSuggestionService error: #{e.class} #{e.message}"
    Rails.logger.error e.backtrace.first(3).join("\n")
    []
  end

  private

  def call_anthropic
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
      tools: [tool_definition],
      tool_choice: { type: 'tool', name: 'suggest_relationships' },
      system: system_prompt,
      messages: [{ role: 'user', content: user_prompt }],
    }.to_json

    http.request(request)
  end

  def tool_definition
    {
      name: 'suggest_relationships',
      description: 'Return high-confidence relationships between the focal concept and candidates.',
      input_schema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            description: 'Up to 7 strong relationships.  Quality over quantity — return an empty array if nothing fits well.',
            items: {
              type: 'object',
              properties: {
                target_id:  { type: 'integer', description: 'The id from the candidates list' },
                rel_type:   { type: 'string', enum: SUGGESTABLE_REL_TYPES },
                reasoning:  { type: 'string', description: 'One concise sentence.  No hedging, no preamble.' },
              },
              required: %w[target_id rel_type reasoning],
            },
          },
        },
        required: %w[suggestions],
      },
    }
  end

  def system_prompt
    rel_lines = SUGGESTABLE_REL_TYPES.map { |t| "  - #{t}: #{REL_TYPE_HINTS[t]}" }.join("\n")
    <<~PROMPT
      You are a research assistant for Map My Research, a workspace where
      researchers organize the literature in their field.  Given a focal
      concept and a list of candidate concepts already in the user's library,
      identify likely relationships.

      Available relationship types:
      #{rel_lines}

      Rules:
      1. Quality over quantity.  Propose 0–7 strong relationships.  An empty
         list is the right answer when nothing fits well.
      2. Only use target_ids that appear in the candidates list.  Never
         invent or guess ids.
      3. Pick the SINGLE best rel_type per pair.  Use related_to only when
         no stronger relation fits.
      4. Reasoning is one short factual sentence.  No "I think", no "may be",
         no marketing language.  If you can't justify it cleanly, skip it.
    PROMPT
  end

  def user_prompt
    focal_lines = []
    focal_lines << "ID: #{@concept.id}"
    focal_lines << "Label: #{@concept.label}"
    focal_lines << "Type: #{@concept.effective_concept_type || 'untyped'}"
    focal_lines << "Summary: #{@concept.summary}" if @concept.summary.present?
    if @concept.description.present?
      stripped = ActionController::Base.helpers.strip_tags(@concept.description.to_s).strip
      focal_lines << "Description: #{stripped[0, 600]}" if stripped.present?
    end

    candidate_lines = @candidates.map do |c|
      type = c[:concept_type].present? ? c[:concept_type] : 'untyped'
      "  #{c[:id]} · #{c[:label]} · #{type}"
    end.join("\n")

    <<~PROMPT
      FOCAL CONCEPT
      #{focal_lines.join("\n")}

      CANDIDATES (id · label · type)
      #{candidate_lines}

      Use the suggest_relationships tool to return your proposals.
    PROMPT
  end

  def parse_tool_use(response)
    return [] unless response.is_a?(Net::HTTPSuccess)

    body = JSON.parse(response.body)
    blocks = body['content'] || []
    tool_block = blocks.find { |b| b['type'] == 'tool_use' && b['name'] == 'suggest_relationships' }
    return [] unless tool_block

    raw = tool_block.dig('input', 'suggestions') || []
    candidate_ids = @candidates.to_set { |c| c[:id] }

    raw.map do |s|
      target_id = s['target_id']
      next nil unless candidate_ids.include?(target_id)
      next nil unless SUGGESTABLE_REL_TYPES.include?(s['rel_type'])
      Result.new(
        target_id: target_id,
        rel_type:  s['rel_type'],
        reasoning: s['reasoning'].to_s.strip,
      )
    end.compact
  end
end
