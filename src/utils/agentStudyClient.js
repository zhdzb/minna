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

  const loadProgressReview = async () =>
    request('progress', {
      method: 'GET'
    })

  const loadLatestReview = async () =>
    request('review/latest', {
      method: 'GET'
    })

  const loadLatestReviewDrill = async () =>
    request('review-drill/latest', {
      method: 'GET'
    })

  const loadMistakes = async () =>
    request('mistakes', {
      method: 'GET'
    })

  const loadReviewReading = async () =>
    request('review-reading', {
      method: 'GET'
    })

  const updateReviewReading = async ({ reviewId, reviewFile, exerciseId, status } = {}) =>
    request('review-reading', {
      method: 'POST',
      body: JSON.stringify({ reviewId, reviewFile, exerciseId, status })
    })

  const loadVocabulary = async () =>
    request('vocabulary', {
      method: 'GET'
    })

  const submitMistakeAttempt = async ({ mistakeId, answer } = {}) =>
    request('mistakes/attempt', {
      method: 'POST',
      body: JSON.stringify({ mistakeId, answer })
    })

  const dismissMistake = async ({ mistakeId } = {}) =>
    request('mistakes/dismiss', {
      method: 'POST',
      body: JSON.stringify({ mistakeId })
    })

  const addManualMistake = async ({ exerciseId, dailyPath, reviewPath } = {}) =>
    request('mistakes/add', {
      method: 'POST',
      body: JSON.stringify({ exerciseId, dailyPath, reviewPath })
    })

  const setMistakeStatus = async ({ mistakeId, mistakeIds, status } = {}) =>
    request('mistakes/status', {
      method: 'POST',
      body: JSON.stringify({ mistakeId, mistakeIds, status })
    })

  const loadMistakeDrillSession = async () =>
    request('mistake-drill-session', {
      method: 'GET'
    })

  const startMistakeDrillSession = async ({ size, mistakeIds } = {}) =>
    request('mistake-drill-session/start', {
      method: 'POST',
      body: JSON.stringify({ size, mistakeIds })
    })

  const advanceMistakeDrillSession = async ({ mistakeId } = {}) =>
    request('mistake-drill-session/advance', {
      method: 'POST',
      body: JSON.stringify({ mistakeId })
    })

  const endMistakeDrillSession = async () =>
    request('mistake-drill-session/end', {
      method: 'POST',
      body: JSON.stringify({})
    })

  const loadPromptFile = async (promptPath) =>
    request('prompt?path=' + encodeURIComponent(String(promptPath || '').trim()), {
      method: 'GET'
    })

  const loadSyllabus = async () =>
    request('syllabus', {
      method: 'GET'
    })

  const saveSyllabus = async (syllabus) =>
    request('syllabus', {
      method: 'POST',
      body: JSON.stringify(syllabus)
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

  const saveReviewDrill = async ({ reviewDrill, targetPath } = {}) =>
    request('review-drill/save', {
      method: 'POST',
      body: JSON.stringify({
        reviewDrill,
        ...(typeof targetPath === 'string' && targetPath.trim() !== ''
          ? { targetPath: targetPath.trim() }
          : {})
      })
    })

  const submitReviewDrill = async ({ reviewDrill, targetPath } = {}) =>
    request('review-drill/submit', {
      method: 'POST',
      body: JSON.stringify({
        reviewDrill,
        ...(typeof targetPath === 'string' && targetPath.trim() !== ''
          ? { targetPath: targetPath.trim() }
          : {})
      })
    })

  return {
    addManualMistake,
    advanceMistakeDrillSession,
    loadLatestAgentStudy,
    loadProgressReview,
    loadPromptFile,
    loadLatestReviewDrill,
    loadLatestReview,
    loadMistakeDrillSession,
    loadMistakes,
    loadReviewReading,
    loadVocabulary,
    dismissMistake,
    endMistakeDrillSession,
    loadSyllabus,
    saveDailyPacket,
    saveSyllabus,
    saveReviewDrill,
    submitReviewDrill,
    submitMistakeAttempt,
    submitDailyPacket,
    setMistakeStatus,
    startMistakeDrillSession,
    updateReviewReading
  }
}

export {
  DEFAULT_AGENT_STUDY_API_BASE,
  buildAgentStudyUrl,
  createAgentStudyClient
}
