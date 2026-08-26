import {
  validateCurrent,
  validateDailyPacket,
  validateMastery,
  validateProfile,
  validateReviewQueue,
  validateReviewResult
} from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'
import { createAgentStudyFileStore } from './fileStore.js'
import { createAgentStudyMistakeStore, MISTAKE_BOOK_PATH } from './mistakeStore.js'
import {
  createMistakeDrillSessionStore,
  MISTAKE_DRILL_SESSION_PATH
} from './mistakeDrillSessionStore.js'
import { createReviewReadingStore } from './reviewReadingStore.js'
import { createSyllabusStore } from './syllabusStore.js'
import { createAgentStudyVocabularyStore } from './vocabularyStore.js'
import { deriveAgentStudyPhase, matchesDaily } from '../../utils/agentStudyPhase.js'

const assertJsonObject = (payload, label) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(label + ' requires a JSON object payload')
  }

  return payload
}

const resolveDailyTargetPath = ({ payload, fileStore }) => {
  if (typeof payload.targetPath === 'string' && payload.targetPath.trim() !== '') {
    return payload.targetPath.trim()
  }

  const indexDocument = fileStore.loadIndex()
  if (typeof indexDocument.latest_daily === 'string' && indexDocument.latest_daily.trim() !== '') {
    return indexDocument.latest_daily
  }

  const dailyPacket = payload.dailyPacket || {}
  if (typeof dailyPacket.date === 'string' && dailyPacket.date.trim() !== '') {
    return 'study/daily/' + dailyPacket.date.trim() + '.json'
  }

  throw new Error('agent study route requires targetPath or a resolvable daily packet date')
}

const handleGetLatestAgentStudy = async ({ fileStore = createAgentStudyFileStore() } = {}) => {
  const index = fileStore.loadIndex()
  const dailyPacket = fileStore.loadLatestDaily()
  const latestReviewResult = fileStore.loadLatestReview()
  const reviewQueue = fileStore.readStudyJson('study/state/review-queue.json', validateReviewQueue)
  const reviewResult = matchesDaily(dailyPacket, latestReviewResult) ? latestReviewResult : null
  return {
    index,
    dailyPacket,
    reviewResult,
    latestReviewResult,
    phase: deriveAgentStudyPhase({ dailyPacket, reviewResult, reviewQueue })
  }
}

const handleGetAgentProgressReview = async (
  {
    fileStore = createAgentStudyFileStore(),
    eventLog = createAgentStudyEventLog(),
    recentEventLimit = 8
  } = {}
) => {
  const index = fileStore.loadIndex()
  const dailyPacket = fileStore.loadLatestDaily()
  const latestReviewResult = fileStore.loadLatestReview()
  const reviewQueue = fileStore.readStudyJson('study/state/review-queue.json', validateReviewQueue)
  const reviewResult = matchesDaily(dailyPacket, latestReviewResult) ? latestReviewResult : null

  return {
    index,
    profile: fileStore.readStudyJson('study/state/profile.json', validateProfile),
    current: fileStore.readStudyJson('study/state/current.json', validateCurrent),
    mastery: fileStore.readStudyJson('study/state/mastery.json', validateMastery),
    dailyPacket,
    reviewQueue,
    reviewResult,
    latestReviewResult,
    phase: deriveAgentStudyPhase({ dailyPacket, reviewResult, reviewQueue }),
    recentEvents: eventLog.readRecentEvents(recentEventLimit),
    nextAgentContext: {
      path: 'study/context/next-agent-context.md',
      content: fileStore.readStudyText('study/context/next-agent-context.md')
    }
  }
}

const handleGetLatestReview = async ({ fileStore = createAgentStudyFileStore() } = {}) =>
  fileStore.loadLatestReview()

const handleGetLatestReviewDrill = async ({ fileStore = createAgentStudyFileStore() } = {}) =>
  fileStore.loadLatestReviewDrill()

const handleGetMistakes = async ({
  mistakeStore = createAgentStudyMistakeStore()
} = {}) => mistakeStore.loadMistakeBook()

const handleGetReviewReading = async ({
  reviewReadingStore = createReviewReadingStore()
} = {}) => reviewReadingStore.load()

const handleUpdateReviewReading = async (
  payload,
  { reviewReadingStore = createReviewReadingStore() } = {}
) => {
  const normalized = assertJsonObject(payload, 'review reading update route')
  return reviewReadingStore.updateItem({
    reviewId: normalized.reviewId,
    reviewFile: normalized.reviewFile,
    exerciseId: normalized.exerciseId,
    status: normalized.status == null ? null : normalized.status
  })
}

const handleGetVocabulary = async ({
  vocabularyStore = createAgentStudyVocabularyStore()
} = {}) => vocabularyStore.loadVocabularyBook()

const handleSubmitMistakeAttempt = async (
  payload,
  {
    mistakeStore = createAgentStudyMistakeStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent mistake attempt route')
  const mistakeId = String(normalized.mistakeId || '').trim()
  const answer = String(normalized.answer || '').trim()
  if (!mistakeId) throw new Error('agent mistake attempt route requires mistakeId')
  if (!answer) throw new Error('agent mistake attempt route requires a non-empty answer')

  const result = mistakeStore.recordAttempt({ mistakeId, answer })
  eventLog.appendEvent({
    actor: 'frontend',
    event: 'mistake_practiced',
    input_files: [MISTAKE_BOOK_PATH],
    output_files: [MISTAKE_BOOK_PATH, 'study/logs/agent-events.jsonl'],
    summary: 'Recorded a repeated mistake practice attempt.'
  })
  return result
}

const handleDismissMistake = async (
  payload,
  {
    mistakeStore = createAgentStudyMistakeStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent mistake dismiss route')
  const mistakeId = String(normalized.mistakeId || '').trim()
  if (!mistakeId) throw new Error('agent mistake dismiss route requires mistakeId')

  const result = mistakeStore.dismissMistake({ mistakeId })
  eventLog.appendEvent({
    actor: 'frontend',
    event: 'mistake_dismissed',
    input_files: [MISTAKE_BOOK_PATH],
    output_files: [MISTAKE_BOOK_PATH, 'study/logs/agent-events.jsonl'],
    summary: 'Dismissed a mistake from the active review list.'
  })
  return result
}

const handleAddManualMistake = async (
  payload,
  {
    fileStore = createAgentStudyFileStore(),
    mistakeStore = createAgentStudyMistakeStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'manual mistake route')
  const exerciseId = String(normalized.exerciseId || '').trim()
  if (!exerciseId) throw new Error('manual mistake route requires exerciseId')

  const index = fileStore.loadIndex()
  const dailyPath = String(normalized.dailyPath || index.latest_daily || '').trim()
  if (!dailyPath) throw new Error('manual mistake route requires a daily packet path')
  const dailyPacket = fileStore.readStudyJson(dailyPath, validateDailyPacket)
  const candidateReviewPath = String(normalized.reviewPath || index.latest_review || '').trim()
  let reviewResult = null
  let reviewPath = null
  if (candidateReviewPath) {
    const candidateReview = fileStore.readStudyJson(candidateReviewPath, validateReviewResult)
    if (candidateReview.daily_id === dailyPacket.id) {
      reviewResult = candidateReview
      reviewPath = candidateReviewPath
    }
  }

  const result = mistakeStore.addManualMistake({
    dailyPacket,
    dailyPath,
    exerciseId,
    reviewResult,
    reviewPath
  })
  eventLog.appendEvent({
    actor: 'frontend',
    event: 'mistake_added_manually',
    input_files: [dailyPath, ...(reviewPath ? [reviewPath] : [])],
    output_files: [MISTAKE_BOOK_PATH, 'study/logs/agent-events.jsonl'],
    summary: 'Added an exercise to the mistake book manually.'
  })
  return result
}

const handleSetMistakeStatus = async (
  payload,
  {
    mistakeStore = createAgentStudyMistakeStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'mistake status route')
  const mistakeIds = Array.isArray(normalized.mistakeIds)
    ? normalized.mistakeIds
    : [normalized.mistakeId]
  const status = String(normalized.status || '').trim()
  const result = mistakeStore.setMistakeStatuses({ mistakeIds, status })
  eventLog.appendEvent({
    actor: 'frontend',
    event: 'mistake_status_changed',
    input_files: [MISTAKE_BOOK_PATH],
    output_files: [MISTAKE_BOOK_PATH, 'study/logs/agent-events.jsonl'],
    summary: `Changed ${result.mistakes.length} mistake item(s) to ${status}.`
  })
  return result
}

const handleGetMistakeDrillSession = async ({
  sessionStore = createMistakeDrillSessionStore()
} = {}) => sessionStore.load()

const handleStartMistakeDrillSession = async (
  payload,
  {
    mistakeStore = createAgentStudyMistakeStore(),
    sessionStore = createMistakeDrillSessionStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'mistake drill start route')
  const session = sessionStore.start({
    mistakeBook: mistakeStore.loadMistakeBook(),
    size: normalized.size,
    mistakeIds: normalized.mistakeIds
  })
  eventLog.appendEvent({
    actor: 'frontend',
    event: 'mistake_drill_started',
    input_files: [MISTAKE_BOOK_PATH],
    output_files: [MISTAKE_DRILL_SESSION_PATH, 'study/logs/agent-events.jsonl'],
    summary: `Started a ${session.mistake_ids.length}-item mistake drill session.`
  })
  return session
}

const handleAdvanceMistakeDrillSession = async (
  payload,
  {
    sessionStore = createMistakeDrillSessionStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'mistake drill progress route')
  const mistakeId = String(normalized.mistakeId || '').trim()
  if (!mistakeId) throw new Error('mistake drill progress route requires mistakeId')
  const session = sessionStore.advance({ mistakeId })
  if (session.status === 'completed') {
    eventLog.appendEvent({
      actor: 'frontend',
      event: 'mistake_drill_completed',
      input_files: [MISTAKE_DRILL_SESSION_PATH],
      output_files: [MISTAKE_DRILL_SESSION_PATH, 'study/logs/agent-events.jsonl'],
      summary: `Completed a ${session.mistake_ids.length}-item mistake drill session.`
    })
  }
  return session
}

const handleEndMistakeDrillSession = async (
  _payload,
  { sessionStore = createMistakeDrillSessionStore() } = {}
) => sessionStore.end()

const handleGetSyllabus = async ({ syllabusStore = createSyllabusStore() } = {}) =>
  syllabusStore.loadSyllabus()

const handleSaveSyllabus = async (
  payload,
  { syllabusStore = createSyllabusStore() } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent study syllabus save route')
  return syllabusStore.saveSyllabus(normalized)
}

const handleGetPromptFile = async (
  payload,
  { fileStore = createAgentStudyFileStore() } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent study prompt route')
  if (typeof normalized.path !== 'string' || normalized.path.trim() === '') {
    throw new Error('agent study prompt route requires a prompt path')
  }

  const promptPath = normalized.path.trim()

  return {
    path: promptPath,
    content: fileStore.readStudyText(promptPath)
  }
}

const handleSaveDailyPacket = async (
  payload,
  {
    fileStore = createAgentStudyFileStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent study save route')
  const dailyPacket = assertJsonObject(normalized.dailyPacket, 'agent study save route dailyPacket')
  const targetPath = resolveDailyTargetPath({ payload: normalized, fileStore })
  const savedPacket = fileStore.saveDailyDraft({ dailyPacket, targetPath })

  eventLog.appendEvent({
    actor: 'frontend',
    event: 'daily_saved',
    input_files: [targetPath],
    output_files: [targetPath, 'study/index.json'],
    summary: 'Saved agent study daily packet draft.'
  })

  return {
    dailyPacket: savedPacket,
    targetPath
  }
}

const handleSubmitDailyPacket = async (
  payload,
  {
    fileStore = createAgentStudyFileStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent study submit route')
  const dailyPacket = assertJsonObject(normalized.dailyPacket, 'agent study submit route dailyPacket')
  const targetPath = resolveDailyTargetPath({ payload: normalized, fileStore })
  const submittedPacket = fileStore.submitDailyPacket({ dailyPacket, targetPath })

  eventLog.appendEvent({
    actor: 'frontend',
    event: 'daily_submitted',
    input_files: [targetPath],
    output_files: [targetPath, 'study/index.json', 'study/logs/agent-events.jsonl'],
    summary: 'Submitted agent study daily packet.'
  })

  return {
    dailyPacket: submittedPacket,
    targetPath
  }
}

const resolveReviewDrillTargetPath = ({ payload, fileStore }) => {
  if (typeof payload.targetPath === 'string' && payload.targetPath.trim() !== '') {
    return payload.targetPath.trim()
  }

  const latestReviewDrill = fileStore.loadLatestReviewDrill()
  if (latestReviewDrill?.date) {
    return 'study/review-drills/' + latestReviewDrill.date + '.json'
  }

  const reviewDrill = payload.reviewDrill || {}
  if (typeof reviewDrill.date === 'string' && reviewDrill.date.trim() !== '') {
    return 'study/review-drills/' + reviewDrill.date.trim() + '.json'
  }

  throw new Error('agent review drill route requires targetPath or a resolvable drill date')
}

const handleSaveReviewDrill = async (
  payload,
  {
    fileStore = createAgentStudyFileStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent review drill save route')
  const reviewDrill = assertJsonObject(
    normalized.reviewDrill,
    'agent review drill save route reviewDrill'
  )
  const targetPath = resolveReviewDrillTargetPath({ payload: normalized, fileStore })
  const savedReviewDrill = fileStore.saveReviewDrillDraft({ reviewDrill, targetPath })

  eventLog.appendEvent({
    actor: 'frontend',
    event: 'review_drill_saved',
    input_files: [targetPath],
    output_files: [targetPath],
    summary: 'Saved review drill draft answers.'
  })

  return {
    reviewDrill: savedReviewDrill,
    targetPath
  }
}

const handleSubmitReviewDrill = async (
  payload,
  {
    fileStore = createAgentStudyFileStore(),
    eventLog = createAgentStudyEventLog()
  } = {}
) => {
  const normalized = assertJsonObject(payload, 'agent review drill submit route')
  const reviewDrill = assertJsonObject(
    normalized.reviewDrill,
    'agent review drill submit route reviewDrill'
  )
  const targetPath = resolveReviewDrillTargetPath({ payload: normalized, fileStore })
  const submittedReviewDrill = fileStore.submitReviewDrill({ reviewDrill, targetPath })

  eventLog.appendEvent({
    actor: 'frontend',
    event: 'review_drill_submitted',
    input_files: [targetPath],
    output_files: [targetPath, 'study/logs/agent-events.jsonl'],
    summary: 'Submitted review drill answers.'
  })

  return {
    reviewDrill: submittedReviewDrill,
    targetPath
  }
}

export {
  handleAddManualMistake,
  handleAdvanceMistakeDrillSession,
  handleGetAgentProgressReview,
  handleDismissMistake,
  handleEndMistakeDrillSession,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleGetLatestReviewDrill,
  handleGetLatestReview,
  handleGetMistakes,
  handleGetMistakeDrillSession,
  handleGetReviewReading,
  handleGetVocabulary,
  handleGetSyllabus,
  handleSaveDailyPacket,
  handleSaveSyllabus,
  handleSaveReviewDrill,
  handleSubmitReviewDrill,
  handleSubmitMistakeAttempt,
  handleSubmitDailyPacket,
  handleSetMistakeStatus,
  handleStartMistakeDrillSession,
  handleUpdateReviewReading
}
