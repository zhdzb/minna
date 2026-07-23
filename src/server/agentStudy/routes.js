import {
  validateCurrent,
  validateMastery,
  validateProfile,
  validateReviewQueue
} from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'
import { createAgentStudyFileStore } from './fileStore.js'
import { createAgentStudyMistakeStore, MISTAKE_BOOK_PATH } from './mistakeStore.js'
import { createSyllabusStore } from './syllabusStore.js'
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
  handleGetAgentProgressReview,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleGetLatestReviewDrill,
  handleGetLatestReview,
  handleGetMistakes,
  handleGetSyllabus,
  handleSaveDailyPacket,
  handleSaveSyllabus,
  handleSaveReviewDrill,
  handleSubmitReviewDrill,
  handleSubmitMistakeAttempt,
  handleSubmitDailyPacket
}
