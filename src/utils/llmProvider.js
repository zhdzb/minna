const DEFAULTS = {
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  openaiModel: 'gpt-5.4',
  openaiBaseUrl: 'https://llmapi.devart.ai',
  openaiReasoningEffort: 'xhigh'
}

const safeWindow = () => (typeof window !== 'undefined' ? window : null)

const getLocalStorageValue = (key, fallback = '') => {
  const win = safeWindow()
  if (!win?.localStorage) return fallback
  const value = win.localStorage.getItem(key)
  return value == null || value === '' ? fallback : value
}

const getConfigValue = (key, fallback = '') => {
  const win = safeWindow()
  if (win?.CONFIG && key in win.CONFIG) {
    const value = win.CONFIG[key]
    return value == null || value === '' ? fallback : value
  }
  return fallback
}

const normalizeProvider = (provider) => {
  const value = String(provider || '').toLowerCase().trim()
  return value === 'openai' ? 'openai' : 'gemini'
}

export const buildProviderConfig = (overrides = {}) => {
  const provider = normalizeProvider(
    overrides.provider ||
      getConfigValue('LLM_PROVIDER') ||
      getLocalStorageValue('llm_provider', DEFAULTS.provider)
  )

  const geminiModel =
    overrides.geminiModel ||
    getConfigValue('GEMINI_MODEL') ||
    getLocalStorageValue('gemini_model', DEFAULTS.geminiModel)

  const openaiModel =
    overrides.openaiModel ||
    getConfigValue('OPENAI_MODEL') ||
    getLocalStorageValue('openai_model', DEFAULTS.openaiModel)

  const openaiBaseUrl =
    overrides.openaiBaseUrl ||
    getConfigValue('OPENAI_BASE_URL') ||
    getLocalStorageValue('openai_base_url', DEFAULTS.openaiBaseUrl)

  const openaiReasoningEffort =
    overrides.openaiReasoningEffort ||
    getConfigValue('OPENAI_REASONING_EFFORT') ||
    getLocalStorageValue('openai_reasoning_effort', DEFAULTS.openaiReasoningEffort)

  const apiKey =
    overrides.apiKey ||
    (provider === 'openai' ? getConfigValue('OPENAI_API_KEY') : getConfigValue('GEMINI_API_KEY'))

  return {
    provider,
    apiKey,
    geminiModel,
    openaiModel,
    openaiBaseUrl,
    openaiReasoningEffort,
    timeoutMs: overrides.timeoutMs,
    maxRetries: overrides.maxRetries
  }
}

const buildOpenAIUrl = (baseUrl) => {
  const trimmed = String(baseUrl || DEFAULTS.openaiBaseUrl).replace(/\/+$/, '')
  if (trimmed.endsWith('/v1/responses')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/responses`
  return `${trimmed}/v1/responses`
}

const isDevProxyEnabled = () => {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
  } catch (_error) {
    return false
  }
}

const buildProxyBody = (url, headers, body) => ({
  url,
  headers,
  body
})

const extractOpenAIText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim() !== '') {
    return data.output_text
  }

  const outputs = Array.isArray(data?.output) ? data.output : []
  for (const output of outputs) {
    const contents = Array.isArray(output?.content) ? output.content : []
    for (const item of contents) {
      if (typeof item?.text === 'string' && item.text.trim() !== '') {
        return item.text
      }
    }
  }

  return ''
}

const extractGeminiText = (data) => {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  return typeof text === 'string' ? text : ''
}

const parseOpenAISsePayload = (rawText) => {
  const lines = String(rawText || '').split(/\r?\n/)
  let finalResponse = null
  let deltaText = ''

  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue

    try {
      const eventData = JSON.parse(payload)

      if (typeof eventData?.delta === 'string') {
        deltaText += eventData.delta
      }

      if (typeof eventData?.output_text === 'string') {
        deltaText += eventData.output_text
      }

      if (eventData?.response && typeof eventData.response === 'object') {
        finalResponse = eventData.response
      }

      if (eventData?.type === 'response.completed' && eventData?.response) {
        finalResponse = eventData.response
      }
    } catch (_error) {
      // Ignore malformed SSE payload lines and keep scanning.
    }
  }

  if (finalResponse) {
    if (!finalResponse.output_text && deltaText.trim()) {
      finalResponse.output_text = deltaText
    }
    return finalResponse
  }

  if (deltaText.trim()) {
    return { output_text: deltaText }
  }

  throw new Error('API returned a non-JSON streaming response')
}

const parseOpenAIResponse = async (response) => {
  if (typeof response?.text !== 'function') {
    if (typeof response?.json === 'function') {
      return response.json()
    }
    throw new Error('API response object is missing both text() and json() readers')
  }

  const rawText = await response.text()
  const trimmed = rawText.trim()
  if (!trimmed) return {}

  try {
    return JSON.parse(trimmed)
  } catch (_error) {
    if (trimmed.includes('event:') || trimmed.includes('data:')) {
      return parseOpenAISsePayload(trimmed)
    }
    throw new Error(`API returned invalid JSON: ${trimmed.slice(0, 120)}`)
  }
}

const requestWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

const isRetryableStatus = (status) =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504

const requestWithRetry = async (url, options, timeoutMs, maxRetries) => {
  let lastError
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await requestWithTimeout(url, options, timeoutMs)
      if (!response.ok && isRetryableStatus(response.status) && attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (error.name === 'AbortError') {
        throw new Error(`API request timed out after ${timeoutMs}ms`)
      }
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

const buildHttpError = async (response) => {
  const status = response?.status
  let detail = ''
  try {
    const raw = await response.text()
    if (raw && raw.trim()) {
      try {
        const parsed = JSON.parse(raw)
        const msg = parsed?.error?.message || parsed?.message || parsed?.error || parsed?.type
        detail = typeof msg === 'string' && msg.trim() ? msg.trim() : raw.trim()
      } catch (_error) {
        detail = raw.trim()
      }
    }
  } catch (_error) {
    // Ignore text parsing errors and return status-only message.
  }

  const suffix = detail ? `: ${detail.slice(0, 300)}` : ''
  return new Error(`API request failed with status ${status}${suffix}`)
}

export const requestLlmText = async ({
  providerConfig,
  systemPrompt,
  userPrompt,
  generationConfig = {}
}) => {
  const config = buildProviderConfig(providerConfig || {})
  const timeoutMs = config.timeoutMs || 120000
  const maxRetries = config.maxRetries || 3

  if (!config.apiKey) {
    throw new Error(`${config.provider === 'openai' ? 'OpenAI' : 'Gemini'} API key is missing`)
  }

  const useDevProxy = isDevProxyEnabled()

  if (config.provider === 'openai') {
    const url = buildOpenAIUrl(config.openaiBaseUrl)
    const body = {
      model: config.openaiModel,
      input: userPrompt,
      instructions: systemPrompt,
      stream: false,
      temperature: generationConfig.temperature
    }

    // Only force json_object when caller explicitly asks for JSON mime mode.
    // Some tasks (e.g. evaluation) need top-level arrays, which conflict with json_object.
    if (generationConfig.responseMimeType === 'application/json') {
      body.text = { format: { type: 'json_object' } }
    }

    if (typeof generationConfig.maxOutputTokens === 'number') {
      body.max_output_tokens = generationConfig.maxOutputTokens
    }

    if (typeof generationConfig.topP === 'number') {
      body.top_p = generationConfig.topP
    }

    if (config.openaiReasoningEffort) {
      body.reasoning = { effort: config.openaiReasoningEffort }
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    }

    const response = await requestWithRetry(
      useDevProxy ? '/api/llm/openai' : url,
      {
        method: 'POST',
        headers: useDevProxy ? { 'Content-Type': 'application/json' } : requestHeaders,
        body: JSON.stringify(
          useDevProxy ? buildProxyBody(url, requestHeaders, body) : body
        )
      },
      timeoutMs,
      maxRetries
    )

    if (!response.ok) {
      throw await buildHttpError(response)
    }

    const data = await parseOpenAIResponse(response)
    const text = extractOpenAIText(data)
    if (!text.trim()) {
      throw new Error('API returned an empty response body')
    }
    return text
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`
  const response = await requestWithRetry(
    useDevProxy ? '/api/llm/gemini' : `${geminiUrl}?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        useDevProxy
          ? buildProxyBody(`${geminiUrl}?key=${config.apiKey}`, { 'Content-Type': 'application/json' }, {
              contents: [
                {
                  parts: [{ text: userPrompt }]
                }
              ],
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              generationConfig: {
                temperature: generationConfig.temperature,
                topP: generationConfig.topP,
                topK: generationConfig.topK,
                maxOutputTokens: generationConfig.maxOutputTokens,
                responseMimeType: generationConfig.responseMimeType
              }
            })
          : {
              contents: [
                {
                  parts: [{ text: userPrompt }]
                }
              ],
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              generationConfig: {
                temperature: generationConfig.temperature,
                topP: generationConfig.topP,
                topK: generationConfig.topK,
                maxOutputTokens: generationConfig.maxOutputTokens,
                responseMimeType: generationConfig.responseMimeType
              }
            }
      )
    },
    timeoutMs,
    maxRetries
  )

  if (!response.ok) {
    throw await buildHttpError(response)
  }

  const data = await response.json()
  const text = extractGeminiText(data)
  if (!text.trim()) {
    throw new Error('API returned an empty response body')
  }

  return text
}
