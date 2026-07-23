import { createListeningLabStore } from './store.js'

const assertPayload = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' requires a JSON object payload')
  }
  return value
}

const handleGetListeningLab = async ({
  store = createListeningLabStore()
} = {}) => store.loadDashboard()

const handleGenerateListeningSession = async (
  payload = {},
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening session generation')
  return store.generateSession({
    scenarioId:
      typeof normalized.scenarioId === 'string' ? normalized.scenarioId.trim() : ''
  })
}

const handleSaveListeningAttempt = async (
  payload,
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening attempt save')
  return store.saveAttempt({
    attempt: assertPayload(normalized.attempt, 'listening attempt save.attempt')
  })
}

const handleSubmitListeningAttempt = async (
  payload,
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening attempt submit')
  return store.submitAttempt({
    attempt: assertPayload(normalized.attempt, 'listening attempt submit.attempt')
  })
}

const handleRetryListeningSession = async (
  payload,
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening session retry')
  const sessionId = String(normalized.sessionId || '').trim()
  if (!sessionId) throw new Error('listening session retry requires sessionId')
  return store.retrySession({ sessionId })
}

const handleSaveListeningRecording = async (
  payload,
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening recording save')
  const attemptId = String(normalized.attemptId || '').trim()
  const segmentId = String(normalized.segmentId || '').trim()
  const dataUrl = String(normalized.dataUrl || '').trim()
  if (!attemptId || !segmentId || !dataUrl) {
    throw new Error('listening recording save requires attemptId, segmentId and dataUrl')
  }
  return store.saveRecording({ attemptId, segmentId, dataUrl })
}

const handleGetListeningRecording = async (
  payload,
  { store = createListeningLabStore() } = {}
) => {
  const normalized = assertPayload(payload, 'listening recording load')
  return store.resolveRecording(String(normalized.path || '').trim())
}

export {
  handleGenerateListeningSession,
  handleGetListeningLab,
  handleGetListeningRecording,
  handleRetryListeningSession,
  handleSaveListeningAttempt,
  handleSaveListeningRecording,
  handleSubmitListeningAttempt
}
