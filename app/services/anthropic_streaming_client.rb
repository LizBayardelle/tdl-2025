require 'net/http'
require 'json'

# Thin wrapper around the Anthropic Messages API that streams the response,
# parses Server-Sent Events, and reconstructs the final content blocks.
#
# Used by ConceptGeneratorService and ConceptFactCheckerService — anything
# that needs a long-running call with web_search/code_execution where a
# non-streaming HTTP connection would be killed by intermediate proxies.
#
# Caller passes the request body as a hash (model, system, tools, messages,
# etc.). The client adds `stream: true` and handles the rest. Returns:
#
#   { content_blocks: [...], usage: {...}, stop_reason: '...' }
#
# Handles `pause_turn` automatically — the server-side loop (web_search +
# adaptive thinking) can hit its iteration cap, in which case the request is
# re-sent with the accumulated assistant content until the model finishes.
class AnthropicStreamingClient
  class Error < StandardError; end
  class ApiError < Error; end
  class TransientApiError < Error; end
  class MissingApiKey < Error; end

  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  RETRYABLE_CODES = %w[502 503 504 529].freeze
  MAX_TRANSIENT_RETRIES = 2
  MAX_PAUSE_CONTINUATIONS = 6

  def initialize(logger: Rails.logger)
    @logger = logger
  end

  # request_body: hash with model, system, tools, messages, max_tokens, etc.
  # The user message text is needed separately so we can re-assemble the
  # messages array for pause_turn continuations.
  def call(request_body, user_message_text:)
    raise MissingApiKey, 'ANTHROPIC_API_KEY env var is not set' if ENV['ANTHROPIC_API_KEY'].blank?

    messages = request_body[:messages] || request_body['messages'] || [{ role: 'user', content: user_message_text }]
    all_blocks = []
    usage_totals = Hash.new(0)
    continuations = 0

    loop do
      body_with_stream = request_body.merge(messages: messages, stream: true)
      blocks, usage, stop_reason = stream_with_retry(body_with_stream)

      all_blocks.concat(blocks)
      accumulate_usage!(usage_totals, usage)

      break if stop_reason != 'pause_turn'

      continuations += 1
      raise Error, "pause_turn exceeded #{MAX_PAUSE_CONTINUATIONS} continuations" if continuations > MAX_PAUSE_CONTINUATIONS

      messages = [
        { role: 'user', content: user_message_text },
        { role: 'assistant', content: blocks }
      ]
    end

    { content_blocks: all_blocks, usage: usage_totals, stop_reason: 'end_turn' }
  end

  private

  def stream_with_retry(request_body)
    attempt = 0
    loop do
      attempt += 1
      begin
        return stream_once(request_body)
      rescue TransientApiError, Net::ReadTimeout, Net::OpenTimeout, Errno::ECONNRESET, Errno::ETIMEDOUT => e
        if attempt > MAX_TRANSIENT_RETRIES
          raise ApiError, "Transient failure after #{MAX_TRANSIENT_RETRIES} retries: #{e.class} #{e.message}"
        end
        wait = 2**attempt
        @logger.warn "AnthropicStreamingClient: transient #{e.class} (#{e.message}), retrying in #{wait}s (#{attempt}/#{MAX_TRANSIENT_RETRIES})"
        sleep(wait)
      end
    end
  end

  def stream_once(request_body)
    uri = URI(ANTHROPIC_API_URL)
    state = { blocks: {}, usage: {}, stop_reason: nil, server_tool_use_buffers: {} }

    Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 15, read_timeout: 180) do |http|
      request = Net::HTTP::Post.new(uri.path)
      request['Content-Type'] = 'application/json'
      request['Accept'] = 'text/event-stream'
      request['x-api-key'] = ENV['ANTHROPIC_API_KEY']
      request['anthropic-version'] = '2023-06-01'
      request.body = request_body.to_json

      http.request(request) do |response|
        unless response.is_a?(Net::HTTPSuccess)
          body = String.new
          response.read_body { |chunk| body << chunk }
          if RETRYABLE_CODES.include?(response.code)
            raise TransientApiError, "HTTP #{response.code}: #{body.to_s.truncate(200)}"
          end
          raise ApiError, "Claude API #{response.code}: #{body.to_s.truncate(500)}"
        end

        buffer = String.new
        response.read_body do |chunk|
          buffer << chunk
          while (idx = buffer.index("\n\n"))
            event_text = buffer[0...idx]
            buffer = buffer[(idx + 2)..]
            handle_sse_event(event_text, state)
          end
        end
      end
    end

    blocks = state[:blocks].sort.map { |_, b| b }

    if ENV['ANTHROPIC_STREAM_DEBUG'] == '1'
      path = "/tmp/anthropic_stream_blocks_#{Time.current.to_i}_#{rand(1000)}.json"
      summary = blocks.map { |b| b.slice('type', 'id', 'name', 'tool_use_id', 'input').merge(text_len: b['text']&.length, content_count: b['content']&.length) }
      File.write(path, JSON.pretty_generate(summary))
      @logger.info "AnthropicStreamingClient: dumped #{blocks.length} blocks to #{path}"
    end

    [blocks, state[:usage], state[:stop_reason]]
  end

  def handle_sse_event(event_text, state)
    data_lines = []
    event_text.each_line do |line|
      line = line.chomp
      next if line.empty? || line.start_with?(':')
      data_lines << line.sub(/\Adata:\s?/, '') if line.start_with?('data:')
    end
    return if data_lines.empty?

    data = data_lines.join("\n")
    return if data == '[DONE]'

    payload = JSON.parse(data)
    process_event(payload, state)
  rescue JSON::ParserError => e
    @logger.warn "AnthropicStreamingClient: failed to parse SSE data: #{e.message} (data=#{data.to_s.truncate(200)})"
  end

  def process_event(event, state)
    case event['type']
    when 'message_start'
      msg = event['message'] || {}
      merge_usage!(state[:usage], msg['usage'])
    when 'content_block_start'
      idx = event['index']
      block = deep_copy(event['content_block'] || {})
      block['text'] ||= '' if block['type'] == 'text'
      state[:blocks][idx] = block
      state[:server_tool_use_buffers][idx] = String.new if block['type'] == 'server_tool_use'
    when 'content_block_delta'
      idx = event['index']
      block = state[:blocks][idx]
      apply_delta(block, event['delta'] || {}, state, idx) if block
    when 'content_block_stop'
      idx = event['index']
      block = state[:blocks][idx]
      if block && block['type'] == 'server_tool_use'
        buf = state[:server_tool_use_buffers][idx]
        block['input'] = buf.present? ? (JSON.parse(buf) rescue {}) : {}
        state[:server_tool_use_buffers].delete(idx)
      end
    when 'message_delta'
      delta = event['delta'] || {}
      state[:stop_reason] = delta['stop_reason'] if delta.key?('stop_reason')
      merge_usage!(state[:usage], event['usage'])
    when 'message_stop'
      # terminal; stream loop exits when read_body returns
    when 'error'
      err = event['error'] || {}
      raise ApiError, "Stream error: #{err['type']} #{err['message']}"
    when 'ping'
      # keepalive
    end
  end

  def apply_delta(block, delta, state, idx)
    case delta['type']
    when 'text_delta'
      block['text'] = block['text'].to_s + delta['text'].to_s
    when 'input_json_delta'
      state[:server_tool_use_buffers][idx] ||= String.new
      state[:server_tool_use_buffers][idx] << delta['partial_json'].to_s
    when 'citations_delta'
      citation = delta['citation']
      if citation
        block['citations'] ||= []
        block['citations'] << citation
      end
    when 'thinking_delta', 'signature_delta'
      # adaptive thinking content is omitted by default; nothing to capture
    end
  end

  def merge_usage!(usage, incoming)
    return unless incoming.is_a?(Hash)

    %w[input_tokens output_tokens cache_creation_input_tokens cache_read_input_tokens].each do |k|
      usage[k] = usage[k].to_i + incoming[k].to_i if incoming.key?(k)
    end

    if incoming['server_tool_use'].is_a?(Hash) && incoming['server_tool_use']['web_search_requests']
      usage['server_tool_use'] ||= { 'web_search_requests' => 0 }
      usage['server_tool_use']['web_search_requests'] += incoming['server_tool_use']['web_search_requests'].to_i
    end
  end

  def accumulate_usage!(totals, usage)
    return unless usage.is_a?(Hash)

    %w[input_tokens output_tokens cache_creation_input_tokens cache_read_input_tokens].each do |key|
      totals[key] = totals[key].to_i + usage[key].to_i
    end

    web_requests = usage.dig('server_tool_use', 'web_search_requests')
    totals['web_search_requests'] = totals['web_search_requests'].to_i + web_requests.to_i if web_requests
  end

  def deep_copy(obj)
    JSON.parse(JSON.generate(obj))
  end
end
