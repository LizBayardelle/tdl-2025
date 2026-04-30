require 'net/http'
require 'json'

# Calls Haiku with a dynamically-built tool schema where every controlled-vocab
# field is enum-constrained. The model literally cannot return a value that
# would fail StatisticalTest's inclusion validations.
#
# Returns a Hash of attribute => value pairs. Fields the model omitted (because
# it wasn't confident) are absent from the hash. Returns {} on any error and
# never raises.
class StatisticalTestAttributesGenerator
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-haiku-4-5-20251001'
  TOOL_NAME = 'fill_statistical_test_attributes'.freeze

  # Hand-written prose that helps the model interpret a few non-obvious fields.
  # Most columns are self-explanatory from their enum values; these aren't.
  FIELD_HINTS = {
    outcome_approximately_normal:
      'Does the TEST assume the outcome is approximately normal? Yes for parametric tests (t-test, ANOVA, linear regression). No for nonparametric. Not Applicable when outcome is categorical/binary/count.',
    equal_variances_assumed:
      "Does the test assume equal variances across groups? Yes for Student's t and standard ANOVA. No for Welch's t. Not Applicable for non-comparison tests.",
    parametric_assumptions_reasonably_met:
      'Does this test rely on parametric assumptions overall? Yes for parametric tests, No for nonparametric, Unknown if context-dependent.',
    covariates_included:
      'Whether the test natively handles covariates. Required = the test is FOR covariate adjustment (e.g., ANCOVA). Supported = optional extension (e.g., multiple regression). Not Supported = no.',
    nested_or_clustered_data:
      'Whether the test handles nested/clustered data. Required = it is FOR clustered data (mixed models, GEE). Supported = can be extended. Not Supported = standard test assumes independence.',
    mediation:
      'Whether the test addresses mediation. Required = the test is FOR mediation. Supported = can express it. Not Supported = no.',
    moderation:
      'Whether the test addresses moderation/interactions. Required = the test is FOR interactions. Supported = via interaction terms. Not Supported = no.',
    censoring_present:
      'Whether the test handles censored data. Required = survival/time-to-event tests. Not Supported = otherwise.',
    overdispersion_present:
      'Relevant only for count outcome models. Yes = explicitly handles overdispersion (NegBin, ZINB). No = does not (Poisson). Not Applicable = non-count outcome.',
    many_zero_values:
      'Yes only for zero-inflated models (ZIP, ZINB). No for other count models. Not Applicable for non-count outcomes.',
    primary_variable_2_type:
      "Type of the second key variable. Use 'Mixed' when the test admits predictors of multiple types (e.g., multiple regression's RHS). Use 'None / Not Applicable' when the test has only one variable.",
    time_matters_to_analysis:
      "Yes only when temporal ordering is part of the analysis (survival, growth curves, longitudinal). No when 'time' is just an identifier or condition label.",
  }.freeze

  def initialize(name:, description: nil, aliases: nil)
    @name = name.to_s.strip
    @description = description.to_s.strip
    @aliases = Array(aliases).map(&:to_s).map(&:strip).reject(&:blank?)
  end

  def generate
    return {} if @name.blank?
    return {} unless ENV['ANTHROPIC_API_KEY'].present?

    response = call_anthropic
    parse_response(response)
  rescue => e
    Rails.logger.error "StatisticalTestAttributesGenerator error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    {}
  end

  private

  def call_anthropic
    uri = URI(ANTHROPIC_API_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 60

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
    request['anthropic-version'] = '2023-06-01'

    request.body = {
      model: MODEL,
      max_tokens: 1024,
      tools: [tool_schema],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        { role: 'user', content: build_prompt }
      ]
    }.to_json

    http.request(request)
  end

  def tool_schema
    properties = {
      description: {
        type: 'string',
        description: '1–2 sentence plain-language summary of what this test does. Skip the field if a description was already provided.'
      }
    }

    StatisticalTest::SINGLE_SELECT_FIELDS.each do |field, allowed|
      properties[field] = {
        type: 'string',
        enum: allowed,
        description: FIELD_HINTS[field] || "Single value. Pick exactly one or omit the field if uncertain."
      }
    end

    StatisticalTest::MULTI_SELECT_FIELDS.each do |field, allowed|
      properties[field] = {
        type: 'array',
        items: { type: 'string', enum: allowed },
        description: FIELD_HINTS[field] || 'Zero or more values. Omit the field if uncertain.'
      }
    end

    {
      name: TOOL_NAME,
      description: 'Populate the catalog row for a statistical test. Only include fields you are confident about — omit any field where the answer is genuinely unclear or context-dependent.',
      input_schema: {
        type: 'object',
        properties: properties,
        required: []
      }
    }
  end

  def build_prompt
    aliases_line = @aliases.any? ? "Aliases: #{@aliases.join(', ')}\n" : ''
    desc_line = @description.present? ? "Existing description: #{@description}\n" : ''

    <<~PROMPT
      You are an expert in research methodology and applied statistics.

      Fill in the catalog metadata for the following statistical test according to standard textbook usage.

      Test name: #{@name}
      #{aliases_line}#{desc_line}
      Guidance:
      - Most columns describe properties of the TEST itself (its assumptions, its design, its output), not properties of any specific dataset.
      - For each field, only return a value if it clearly applies according to standard usage. If genuinely unclear or context-dependent, OMIT the field entirely — do not guess.
      - Multi-select fields (`goal`, `primary_output_desired`) can take zero, one, or several values; pick all that clearly apply.
      - For `description`, write 1–2 plain-language sentences. Skip if an existing description was provided.
    PROMPT
  end

  def parse_response(response)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "StatisticalTestAttributesGenerator API failed: #{response.code} #{response.body.to_s.truncate(500)}"
      return {}
    end

    result = JSON.parse(response.body)
    tool_use = Array(result['content']).find { |b| b['type'] == 'tool_use' }
    return {} unless tool_use

    raw = tool_use['input'].is_a?(Hash) ? tool_use['input'] : {}
    sanitize(raw)
  rescue JSON::ParserError => e
    Rails.logger.error "StatisticalTestAttributesGenerator JSON parse error: #{e.message}"
    {}
  end

  # Defense in depth: the enum schema should already filter outputs, but we
  # validate against the model's vocab anyway so a stale schema or unexpected
  # output never sneaks past validations on save.
  def sanitize(raw)
    out = {}

    if raw['description'].is_a?(String) && raw['description'].strip.present?
      out['description'] = raw['description'].strip
    end

    StatisticalTest::SINGLE_SELECT_FIELDS.each do |field, allowed|
      v = raw[field.to_s]
      out[field.to_s] = v if v.is_a?(String) && allowed.include?(v)
    end

    StatisticalTest::MULTI_SELECT_FIELDS.each do |field, allowed|
      vs = Array(raw[field.to_s]).select { |v| v.is_a?(String) && allowed.include?(v) }.uniq
      out[field.to_s] = vs if vs.any?
    end

    out
  end
end
