import {
  validateCurrent,
  validateMastery,
  validateProfile,
  validateReviewQueue
} from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'
import { createAgentStudyFileStore } from './fileStore.js'

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
  return {
    index,
    dailyPacket: fileStore.loadLatestDaily(),
    reviewResult: fileStore.loadLatestReview()
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

  return {
    index,
    profile: fileStore.readStudyJson('study/state/profile.json', validateProfile),
    current: fileStore.readStudyJson('study/state/current.json', validateCurrent),
    mastery: fileStore.readStudyJson('study/state/mastery.json', validateMastery),
    reviewQueue: fileStore.readStudyJson('study/state/review-queue.json', validateReviewQueue),
    reviewResult: fileStore.loadLatestReview(),
    recentEvents: eventLog.readRecentEvents(recentEventLimit),
    nextAgentContext: {
      path: 'study/context/next-agent-context.md',
      content: fileStore.readStudyText('study/context/next-agent-context.md')
    }
  }
}

const handleGetLatestReview = async ({ fileStore = createAgentStudyFileStore() } = {}) =>
  fileStore.loadLatestReview()

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

export {
  handleGetAgentProgressReview,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleGetLatestReview,
  handleSaveDailyPacket,
  handleSubmitDailyPacket
}
