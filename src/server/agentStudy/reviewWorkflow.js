import fs from 'fs'
import path from 'path'
import {
  validateCurrent,
  validateDailyPacket,
  validateIndex,
  validateMastery,
  validatePromotionRules,
  validateReviewQueue,
  validateReviewResult
} from '../../utils/agentStudySchema.js'
import { createAgentStudyContextWriter } from './contextWriter.js'
import { createAgentStudyEventLog } from './eventLog.js'
import { createAgentStudyFileStore, resolveStudyPath } from './fileStore.js'
import { createAgentStudyMistakeStore, MISTAKE_BOOK_PATH } from './mistakeStore.js'
import {
  createAgentStudyVocabularyStore,
  VOCABULARY_PROGRESS_PATH,
  VOCABULARY_SELECTION_PATH
} from './vocabularyStore.js'
import { updateMasteryFromReview } from './masteryUpdater.js'
import { updateReviewQueueFromReview } from './reviewQueueUpdater.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const safeRemoveFile = (fsImpl, filePath) => {
  try {
    fsImpl.unlinkSync(filePath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error
    }
  }
}

const atomicWriteJson = (fsImpl, filePath, value) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8')
  safeRemoveFile(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const writeTextFile = (fsImpl, filePath, content) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, content, 'utf8')
  safeRemoveFile(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const toDateOnly = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Review workflow expected a non-empty timestamp')
  }

  return value.slice(0, 10)
}

const inferDailyPath = ({ dailyPacket, dailyPath, indexDocument }) => {
  if (typeof dailyPath === 'string' && dailyPath.trim() !== '') {
    return dailyPath.trim()
  }

  if (typeof indexDocument.latest_daily === 'string' && indexDocument.latest_daily.trim() !== '') {
    return indexDocument.latest_daily.trim()
  }

  return 'study/daily/' + dailyPacket.date + '.json'
}

const inferReviewPath = ({ reviewResult, reviewPath, dailyPacket }) => {
  if (typeof reviewPath === 'string' && reviewPath.trim() !== '') {
    return reviewPath.trim()
  }

  const dateToken = dailyPacket.date || reviewResult.created_at.slice(0, 10)
  return 'study/reviews/' + dateToken + '-review.json'
}

const buildWeaknessSummary = (reviewResult) =>
  reviewResult.items
    .filter((item) => item.retry_recommended || !item.is_correct || item.needs_user_input)
    .slice(0, 4)
    .map((item) => ({
      scope: 'exercise',
      key: item.exercise_id,
      problem: item.explanation,
      evidence: unique([
        'exercise:' + item.exercise_id,
        item.target_grammar,
        ...(item.error_tags || [])
      ])
    }))

const updateCurrentFromReview = ({
  current,
  dailyPacket,
  reviewResult,
  updatedMastery,
  promotionRules,
  timestamp
}) => {
  const nextCurrent = clone(current)
  const lessonKey = Object.keys(updatedMastery.lesson_states).find(
    (key) => updatedMastery.lesson_states[key]?.lesson === current.current_lesson
  )
  const lessonState = lessonKey ? updatedMastery.lesson_states[lessonKey] : null

  const nextFocus = unique([
    ...(reviewResult.overall.next_focus || []),
    ...reviewResult.items
      .filter((item) => item.retry_recommended || !item.is_correct)
      .map((item) => item.target_grammar)
  ]).slice(0, 4)

  const requiredScores = promotionRules.lesson_gate.required_skill_scores
  const meetsSkillGate =
    lessonState &&
    Object.entries(requiredScores).every(([skill, minimum]) => {
      const currentScore = lessonState.skill_scores?.[skill]
      return typeof currentScore === 'number' && currentScore >= minimum
    })

  const canAdvance =
    Boolean(reviewResult.promotion_decision.can_advance) &&
    reviewResult.overall.accuracy >= promotionRules.lesson_gate.min_output_accuracy &&
    meetsSkillGate

  nextCurrent.revision = current.revision + 1
  nextCurrent.updated_at = timestamp
  nextCurrent.learning_mode = canAdvance ? 'promotion_ready' : current.learning_mode
  nextCurrent.active_goals = unique([
    ...nextFocus,
    ...(current.active_goals || [])
  ]).slice(0, 4)
  nextCurrent.weakness_summary = buildWeaknessSummary(reviewResult)
  nextCurrent.recent_focus = {
    grammar: nextFocus.length > 0 ? nextFocus : current.recent_focus.grammar,
    listening: current.recent_focus.listening,
    speaking: unique([
      ...(current.recent_focus.speaking || []),
      ...reviewResult.items
        .filter((item) => item.error_tags?.includes('naturalness') || item.error_tags?.includes('politeness'))
        .map((item) => item.target_grammar)
    ]).slice(0, 4)
  }
  nextCurrent.next_recommendation = {
    date: toDateOnly(reviewResult.created_at),
    plan_type: canAdvance ? 'review_then_advance' : 'review_then_output',
    minutes: dailyPacket.mission.available_minutes
  }

  return validateCurrent(nextCurrent)
}

const buildReviewedDailyPacket = ({
  existingDaily,
  reviewResult,
  reviewPath,
  timestamp
}) => {
  const nextDaily = clone(existingDaily)
  nextDaily.revision = existingDaily.revision + 1
  nextDaily.updated_at = timestamp
  nextDaily.status = 'reviewed'
  nextDaily.correction = {
    ...existingDaily.correction,
    status: 'reviewed',
    review_file: reviewPath
  }
  nextDaily.review_result = {
    id: reviewResult.id,
    accuracy: reviewResult.overall.accuracy,
    summary: reviewResult.overall.summary
  }
  return validateDailyPacket(nextDaily)
}

const writeContextSnapshot = ({
  contextWriter,
  eventLog,
  studyRoot,
  fsImpl,
  indexDocument,
  currentState,
  masteryState,
  reviewQueueState,
  vocabularySelection
}) => {
  if (typeof contextWriter.buildNextAgentContext === 'function') {
    const recentEvents =
      typeof eventLog.readRecentEvents === 'function' ? eventLog.readRecentEvents(5) : []
    const content = contextWriter.buildNextAgentContext({
      indexDocument,
      currentState,
      masteryState,
      reviewQueueState,
      vocabularySelection,
      recentEvents
    })
    const relativePath = path.posix.join('study', 'context', 'next-agent-context.md')
    writeTextFile(fsImpl, path.join(studyRoot, 'context', 'next-agent-context.md'), content)
    return {
      path: relativePath,
      content
    }
  }

  if (typeof contextWriter.writeNextAgentContext === 'function') {
    return contextWriter.writeNextAgentContext()
  }

  throw new Error('Review workflow requires a context writer with buildNextAgentContext or writeNextAgentContext')
}

const createAgentStudyReviewWorkflow = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  fileStore = createAgentStudyFileStore({ studyRoot, fsImpl, now }),
  mistakeStore = createAgentStudyMistakeStore({ studyRoot, fsImpl, now }),
  vocabularyStore = createAgentStudyVocabularyStore({ studyRoot, fsImpl, now }),
  eventLog = createAgentStudyEventLog({ studyRoot, fsImpl, now }),
  contextWriter = createAgentStudyContextWriter({ studyRoot, fsImpl, now })
} = {}) => {
  const applyReviewResult = ({
    dailyPacket,
    reviewResult,
    dailyPath = null,
    reviewPath = null
  }) => {
    const timestamp = now()
    const normalizedReviewResult = validateReviewResult(clone(reviewResult))
    const indexDocument = fileStore.loadIndex()
    const normalizedDailyPath = inferDailyPath({
      dailyPacket: validateDailyPacket(clone(dailyPacket)),
      dailyPath,
      indexDocument
    })
    const storedDaily = fileStore.readStudyJson(normalizedDailyPath, validateDailyPacket)

    if (storedDaily.id !== dailyPacket.id) {
      throw new Error('Review workflow daily packet id does not match the stored daily packet')
    }

    if (!['submitted', 'reviewed'].includes(storedDaily.status)) {
      throw new Error('Review workflow requires a submitted daily packet')
    }

    if (normalizedReviewResult.daily_id !== storedDaily.id) {
      throw new Error('Review workflow review result does not match the target daily packet')
    }

    const normalizedReviewPath = inferReviewPath({
      reviewResult: normalizedReviewResult,
      reviewPath,
      dailyPacket: storedDaily
    })

    const currentState = fileStore.readStudyJson('study/state/current.json', validateCurrent)
    const masteryState = fileStore.readStudyJson('study/state/mastery.json', validateMastery)
    const reviewQueueState = fileStore.readStudyJson('study/state/review-queue.json', validateReviewQueue)
    const promotionRules = fileStore.readStudyJson('study/state/promotion-rules.json', validatePromotionRules)

    const updatedMastery = updateMasteryFromReview({
      mastery: masteryState,
      reviewResult: normalizedReviewResult,
      now: () => timestamp
    })
    const updatedReviewQueue = updateReviewQueueFromReview({
      reviewQueue: reviewQueueState,
      reviewResult: normalizedReviewResult,
      now: () => timestamp
    })
    const updatedCurrent = updateCurrentFromReview({
      current: currentState,
      dailyPacket: storedDaily,
      reviewResult: normalizedReviewResult,
      updatedMastery,
      promotionRules,
      timestamp
    })
    const updatedDaily = buildReviewedDailyPacket({
      existingDaily: storedDaily,
      reviewResult: normalizedReviewResult,
      reviewPath: normalizedReviewPath,
      timestamp
    })

    const reviewAbsolutePath = resolveStudyPath(studyRoot, normalizedReviewPath)
    const dailyAbsolutePath = resolveStudyPath(studyRoot, normalizedDailyPath)
    const masteryAbsolutePath = path.join(studyRoot, 'state', 'mastery.json')
    const reviewQueueAbsolutePath = path.join(studyRoot, 'state', 'review-queue.json')
    const currentAbsolutePath = path.join(studyRoot, 'state', 'current.json')

    atomicWriteJson(fsImpl, reviewAbsolutePath, normalizedReviewResult)
    atomicWriteJson(fsImpl, masteryAbsolutePath, updatedMastery)
    atomicWriteJson(fsImpl, reviewQueueAbsolutePath, updatedReviewQueue)
    atomicWriteJson(fsImpl, currentAbsolutePath, updatedCurrent)
    atomicWriteJson(fsImpl, dailyAbsolutePath, updatedDaily)
    const updatedMistakeBook = mistakeStore.syncFromReview({
      dailyPacket: storedDaily,
      dailyPath: normalizedDailyPath,
      reviewResult: normalizedReviewResult,
      reviewPath: normalizedReviewPath
    })
    const updatedVocabularyProgress = vocabularyStore.syncFromReview({
      dailyPacket: storedDaily,
      reviewResult: normalizedReviewResult
    })
    const vocabularySelection = vocabularyStore.selectForPacket({
      lesson: updatedCurrent.current_lesson,
      date: updatedCurrent.next_recommendation.date,
      count: 18
    })

    const nextIndex = validateIndex({
      ...indexDocument,
      revision: indexDocument.revision + 1,
      updated_at: timestamp,
      latest_daily: normalizedDailyPath,
      latest_review: normalizedReviewPath,
      latest_prompt: updatedDaily.correction.prompt_file || indexDocument.latest_prompt
    })

    const eventRecord = eventLog.appendEvent({
      actor: 'codex',
      event: 'review_applied',
      input_files: [
        normalizedDailyPath,
        'study/state/mastery.json',
        'study/state/review-queue.json',
        'study/state/current.json'
      ],
      output_files: [
        normalizedReviewPath,
        normalizedDailyPath,
        'study/state/mastery.json',
        'study/state/review-queue.json',
        'study/state/current.json',
        MISTAKE_BOOK_PATH,
        VOCABULARY_PROGRESS_PATH,
        VOCABULARY_SELECTION_PATH,
        'study/logs/agent-events.jsonl'
      ],
      summary: 'Applied submitted-packet review and refreshed study state.'
    })

    const contextResult = writeContextSnapshot({
      contextWriter,
      eventLog,
      studyRoot,
      fsImpl,
      indexDocument: nextIndex,
      currentState: updatedCurrent,
      masteryState: updatedMastery,
      reviewQueueState: updatedReviewQueue,
      vocabularySelection
    })

    atomicWriteJson(fsImpl, path.join(studyRoot, 'index.json'), nextIndex)

    return {
      dailyPacket: updatedDaily,
      reviewResult: normalizedReviewResult,
      mastery: updatedMastery,
      reviewQueue: updatedReviewQueue,
      current: updatedCurrent,
      mistakeBook: updatedMistakeBook,
      vocabularyProgress: updatedVocabularyProgress,
      vocabularySelection,
      index: nextIndex,
      reviewPath: normalizedReviewPath,
      context: contextResult,
      event: eventRecord
    }
  }

  return {
    applyReviewResult
  }
}

export { createAgentStudyReviewWorkflow }
