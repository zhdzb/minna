const DEFAULT_AGENT_STUDY_API_BASE = '/api/agent-study'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const getSafeFetch = (fetchOverride, hasOverride) => {
  if (hasOverride) {
    if (typeof fetchOverride === 'function') return fetchOverride
    return null
  }

  if (typeof fetch === 'function') return fetch
  return null
}

const buildAgentStudyUrl = (baseUrl, path) => {
  const normalizedBase = String(baseUrl || DEFAULT_AGENT_STUDY_API_BASE).replace(/\/+$/, '')
  const normalizedPath = String(path || '').replace(/^\/+/, '')
  return normalizedBase + '/' + normalizedPath
}

const createAgentStudyClientError = (message, details = {}) => {
  const error = new Error(message)
  Object.assign(error, details)
  return error
}

const parseResponseBody = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch (error) {
    throw createAgentStudyClientError('Agent Study API returned invalid JSON', {
      cause: error
    })
  }
}

const createAgentStudyClient = (options = {}) => {
  const resolveFetch = () => getSafeFetch(options.fetchImpl, hasOwn(options, 'fetchImpl'))
  const baseUrl = options.baseUrl || DEFAULT_AGENT_STUDY_API_BASE

  const request = async (path, requestOptions = {}) => {
    const fetchImpl = resolveFetch()
    if (!fetchImpl) {
      throw createAgentStudyClientError('Agent Study client requires fetch support')
    }

    const response = await fetchImpl(buildAgentStudyUrl(baseUrl, path), {
      headers: {
        Accept: 'application/json',
        ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(requestOptions.headers || {})
      },
      ...requestOptions
    })

    const payload = await parseResponseBody(response)

    if (!response.ok || payload?.success === false) {
      throw createAgentStudyClientError(
        payload?.error || `Agent Study API request failed with status ${response.status}`,
        {
          status: response.status,
          payload
        }
      )
    }

    return payload?.data ?? null
  }

  const loadLatestAgentStudy = async () =>
    request('latest', {
      method: 'GET'
    })

  const loadLatestReview = async () =>
    request('review/latest', {
      method: 'GET'
    })

  const loadPromptFile = async (promptPath) =>
    request('prompt?path=' + encodeURIComponent(String(promptPath || '').trim()), {
      method: 'GET'
    })

  const saveDailyPacket = async ({ dailyPacket, targetPath } = {}) =>
    request('daily/save', {
      method: 'POST',
      body: JSON.stringify({
        dailyPacket,
        ...(typeof targetPath === 'string' && targetPath.trim() !== ''
          ? { targetPath: targetPath.trim() }
          : {})
      })
    })

  const submitDailyPacket = async ({ dailyPacket, targetPath } = {}) =>
    request('daily/submit', {
      method: 'POST',
      body: JSON.stringify({
        dailyPacket,
        ...(typeof targetPath === 'string' && targetPath.trim() !== ''
          ? { targetPath: targetPath.trim() }
          : {})
      })
    })

  return {
    loadLatestAgentStudy,
    loadPromptFile,
    loadLatestReview,
    saveDailyPacket,
    submitDailyPacket
  }
}

export {
  DEFAULT_AGENT_STUDY_API_BASE,
  buildAgentStudyUrl,
  createAgentStudyClient
}
