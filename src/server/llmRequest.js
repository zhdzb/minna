import { getServerProviderConfig, getTaskProvider } from './providerConfig'

const parseOpenAIResponse = async (response) => {
  const rawText = await response.text()
  const trimmed = rawText.trim()
  if (!trimmed) return {}

  try {
    return JSON.parse(trimmed)
  } catch (_error) {
    const lines = trimmed.split(/\r?\n/)
    let finalResponse = null
    let deltaText = ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const eventData = JSON.parse(payload)
        if (typeof eventData?.delta === 'string') deltaText += eventData.delta
        if (typeof eventData?.output_text === 'string') deltaText += eventData.output_text
        if (eventData?.response && typeof eventData.response === 'object') {
          finalResponse = eventData.response
        }
      } catch (_innerError) {
        continue
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

    throw new Error(`LLM returned invalid JSON: ${trimmed.slice(0, 120)}`)
  }
}

const extractOpenAIText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text
  }

  const outputs = Array.isArray(data?.output) ? data.output : []
  for (const output of outputs) {
    const contents = Array.isArray(output?.content) ? output.content : []
    for (const item of contents) {
      if (typeof item?.text === 'string' && item.text.trim()) {
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

const buildOpenAIUrl = (baseUrl) => {
  const trimmed = String(baseUrl || '').replace(/\/+$/, '')
  if (trimmed.endsWith('/v1/responses')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/responses`
  return `${trimmed}/v1/responses`
}

const buildSafeHttpError = async (response) => {
  const status = response?.status
  let detail = ''

  try {
    const raw = await response.text()
    if (raw?.trim()) {
      try {
        const parsed = JSON.parse(raw)
        const message = parsed?.error?.message || parsed?.message || parsed?.error || parsed?.type
        detail = typeof message === 'string' ? message.trim() : raw.trim()
      } catch (_error) {
        detail = raw.trim()
      }
    }
  } catch (_error) {
    detail = ''
  }

  return new Error(`LLM request failed with status ${status}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
}

const requestWithTimeout = async (fetchImpl, url, options, timeoutMs) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

const isRetryableStatus = (status) =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504

const requestWithRetry = async (fetchImpl, url, options, timeoutMs, maxRetries) => {
  let lastError

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await requestWithTimeout(fetchImpl, url, options, timeoutMs)
      if (!response.ok && isRetryableStatus(response.status) && attempt < maxRetries - 1) {
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (error.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${timeoutMs}ms`)
      }
      if (attempt === maxRetries - 1) throw error
    }
  }

  throw lastError
}

const buildOpenAIRequest = ({ providerConfig, systemPrompt, userPrompt, generationConfig = {} }) => {
  const body = {
    model: providerConfig.openai.model,
    input: userPrompt,
    instructions: systemPrompt,
    stream: false,
    temperature: generationConfig.temperature
  }

  if (generationConfig.responseMimeType === 'application/json') {
    body.text = { format: { type: 'json_object' } }
  }

  if (typeof generationConfig.maxOutputTokens === 'number') {
    body.max_output_tokens = generationConfig.maxOutputTokens
  }

  if (typeof generationConfig.topP === 'number') {
    body.top_p = generationConfig.topP
  }

  if (providerConfig.openai.reasoningEffort) {
    body.reasoning = { effort: providerConfig.openai.reasoningEffort }
  }

  return {
    url: buildOpenAIUrl(providerConfig.openai.baseUrl),
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${providerConfig.openai.apiKey}`
      },
      body: JSON.stringify(body)
    },
    parse: async (response) => {
      const data = await parseOpenAIResponse(response)
      return extractOpenAIText(data)
    }
  }
}

const buildGeminiRequest = ({ providerConfig, systemPrompt, userPrompt, generationConfig = {} }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${providerConfig.gemini.model}:generateContent?key=${providerConfig.gemini.apiKey}`
  const body = {
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

  return {
    url,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    parse: async (response) => {
      const data = await response.json()
      return extractGeminiText(data)
    }
  }
}

const requestServerLlmText = async ({
  taskName = 'plan',
  systemPrompt,
  userPrompt,
  generationConfig = {},
  fetchImpl = fetch,
  providerOptions = {}
}) => {
  const providerName = getTaskProvider(taskName, providerOptions)
  const providerConfig = getServerProviderConfig(providerOptions)
  const timeoutMs = generationConfig.timeoutMs || 120000
  const maxRetries = generationConfig.maxRetries || 3

  const requestBuilder =
    providerName === 'openai'
      ? buildOpenAIRequest({ providerConfig, systemPrompt, userPrompt, generationConfig })
      : buildGeminiRequest({ providerConfig, systemPrompt, userPrompt, generationConfig })

  const response = await requestWithRetry(
    fetchImpl,
    requestBuilder.url,
    requestBuilder.options,
    timeoutMs,
    maxRetries
  )

  if (!response.ok) {
    throw await buildSafeHttpError(response)
  }

  const text = await requestBuilder.parse(response)
  if (!text.trim()) {
    throw new Error('LLM returned an empty response body')
  }

  return text
}

export { requestServerLlmText }
