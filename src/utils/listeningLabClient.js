const DEFAULT_LISTENING_LAB_API_BASE = '/api/listening-lab'

const buildListeningLabUrl = (baseUrl, path) =>
  String(baseUrl || DEFAULT_LISTENING_LAB_API_BASE).replace(/\/+$/, '') +
  '/' +
  String(path || '').replace(/^\/+/, '')

const parseBody = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    const parseError = new Error('Listening Lab API returned invalid JSON')
    parseError.cause = error
    throw parseError
  }
}

const createListeningLabClient = ({
  fetchImpl = typeof fetch === 'function' ? fetch : null,
  baseUrl = DEFAULT_LISTENING_LAB_API_BASE
} = {}) => {
  const request = async (path, options = {}) => {
    if (typeof fetchImpl !== 'function') {
      throw new Error('Listening Lab client requires fetch support')
    }
    const response = await fetchImpl(buildListeningLabUrl(baseUrl, path), {
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      ...options
    })
    const payload = await parseBody(response)
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.error || 'Listening Lab API request failed with status ' + response.status
      )
    }
    return payload?.data ?? null
  }

  return {
    loadDashboard: () => request('', { method: 'GET' }),
    generateSession: ({ scenarioId = '' } = {}) =>
      request('generate', {
        method: 'POST',
        body: JSON.stringify({ scenarioId })
      }),
    saveAttempt: (attempt) =>
      request('attempt/save', {
        method: 'POST',
        body: JSON.stringify({ attempt })
      }),
    submitAttempt: (attempt) =>
      request('attempt/submit', {
        method: 'POST',
        body: JSON.stringify({ attempt })
      }),
    retrySession: (sessionId) =>
      request('retry', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      }),
    saveRecording: ({ attemptId, segmentId, dataUrl }) =>
      request('recording', {
        method: 'POST',
        body: JSON.stringify({ attemptId, segmentId, dataUrl })
      }),
    buildRecordingUrl: (recordingPath) =>
      buildListeningLabUrl(baseUrl, 'recording?path=' + encodeURIComponent(recordingPath))
  }
}

export {
  DEFAULT_LISTENING_LAB_API_BASE,
  buildListeningLabUrl,
  createListeningLabClient
}
