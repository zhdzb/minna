import fs from 'fs'
import path from 'path'
import {
  validateCurrent,
  validateDailyPacket,
  validateIndex,
  validateMastery,
  validateReviewQueue,
  validateReviewResult
} from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

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

const atomicWriteText = (fsImpl, filePath, content) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, content, 'utf8')
  safeRemoveFile(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const summarizeWeakGrammarPoints = (mastery) => {
  const weakPoints = Object.entries(mastery.grammar_points || {})
    .filter(([, point]) => point.status === 'weak' || point.status === 'learning')
    .sort((left, right) => left[1].controlled_output - right[1].controlled_output)
    .slice(0, 4)
    .map(([key, point]) => key + ' -> ' + point.pattern + ' [' + point.status + ']')

  return weakPoints.length > 0 ? weakPoints : ['No weak grammar points are active right now.']
}

const summarizeDueReviewItems = (reviewQueue) => {
  const dueItems = (reviewQueue.items || [])
    .filter((item) => item.status === 'due')
    .slice(0, 4)
    .map((item) => item.key + ' (' + item.last_result + ', due ' + item.due_date + ')')

  return dueItems.length > 0 ? dueItems : ['No due review queue items right now.']
}

const summarizeReviewOutcome = (reviewResult) => {
  if (!reviewResult) {
    return ['No latest review result is linked in the current index.']
  }

  return [
    'Accuracy: ' + Math.round(reviewResult.overall.accuracy * 100) + '%',
    'Summary: ' + reviewResult.overall.summary,
    'Next focus: ' + (reviewResult.overall.next_focus || []).join(', '),
    'Retry items: ' + reviewResult.items.filter((item) => item.retry_recommended).length
  ]
}

const summarizeDailyPacket = (dailyPacket) => {
  if (!dailyPacket) {
    return ['No latest daily packet is linked in the current index.']
  }

  return [
    'Daily id: ' + dailyPacket.id,
    'Status: ' + dailyPacket.status,
    'Mission: ' + dailyPacket.mission.title,
    'Focus lessons: ' + dailyPacket.mission.focus_lessons.join(', '),
    'Exercises: ' + dailyPacket.exercises.length
  ]
}

const summarizeEvents = (recentEvents) => {
  if (!recentEvents.length) {
    return ['No recent event log entries.']
  }

  return recentEvents.slice(-6).map((event) => {
    const inputCount = event.input_files.length
    const outputCount = event.output_files.length
    return event.time + ' ' + event.event + ' (' + inputCount + ' in / ' + outputCount + ' out)'
  })
}

const buildReadNextFiles = ({ indexDocument, snapshotPath }) =>
  unique([
    'study/index.json',
    'study/state/current.json',
    'study/state/mastery.json',
    'study/state/review-queue.json',
    'study/state/profile.json',
    indexDocument.latest_daily,
    indexDocument.latest_review,
    snapshotPath,
    'study/logs/agent-events.jsonl'
  ])

const buildSnapshotContent = ({
  now,
  indexDocument,
  currentState,
  masteryState,
  reviewQueueState,
  dailyPacket,
  reviewResult,
  previousContext,
  recentEvents,
  snapshotPath
}) => {
  const previousContextLength = typeof previousContext === 'string' ? previousContext.length : 0

  return [
    '# Context Snapshot',
    '',
    '- Generated at: ' + now,
    '- Snapshot path: ' + snapshotPath,
    '- Previous next-agent-context length: ' + previousContextLength + ' chars',
    '- Latest daily path: ' + (indexDocument.latest_daily || 'none'),
    '- Latest review path: ' + (indexDocument.latest_review || 'none'),
    '- Latest prompt path: ' + (indexDocument.latest_prompt || 'none'),
    '',
    '## Current Lesson State',
    '- Current lesson: ' + currentState.current_lesson,
    '- Learning mode: ' + currentState.learning_mode,
    '- Active goals: ' + currentState.active_goals.join(', '),
    '- Current gate: ' + masteryState.current_gate,
    '',
    '## Weak Points',
    ...summarizeWeakGrammarPoints(masteryState).map((line) => '- ' + line),
    '',
    '## Due Review Queue',
    ...summarizeDueReviewItems(reviewQueueState).map((line) => '- ' + line),
    '',
    '## Latest Daily',
    ...summarizeDailyPacket(dailyPacket).map((line) => '- ' + line),
    '',
    '## Latest Review',
    ...summarizeReviewOutcome(reviewResult).map((line) => '- ' + line),
    '',
    '## Recent Events',
    ...summarizeEvents(recentEvents).map((line) => '- ' + line),
    '',
    '## Read Forward',
    ...buildReadNextFiles({ indexDocument, snapshotPath }).map((filePath) => '- ' + filePath)
  ].join('\n') + '\n'
}

const buildCompressedContext = ({
  currentState,
  masteryState,
  reviewQueueState,
  indexDocument,
  reviewResult,
  snapshotPath
}) =>
  [
    '# Next Agent Context',
    '',
    '## Snapshot',
    '- ' + snapshotPath,
    '',
    '## Current',
    '- L' +
      currentState.current_lesson +
      ' · ' +
      currentState.learning_mode +
      ' · gate ' +
      masteryState.current_gate,
    '- Daily: ' + (indexDocument.latest_daily || 'none'),
    '- Review: ' + (indexDocument.latest_review || 'none'),
    '- Weak: ' + summarizeWeakGrammarPoints(masteryState).slice(0, 2).join('; '),
    '- Due: ' + summarizeDueReviewItems(reviewQueueState).slice(0, 2).join('; '),
    '- Focus: ' + (reviewResult ? reviewResult.overall.next_focus.slice(0, 3).join(', ') : 'Read latest review'),
    '',
    '## Next',
    '- Read latest daily + review first.',
    '- Use snapshot for broader history.',
    '- Re-check mastery + queue before changing lesson state.',
    '',
    '## Read',
    ...buildReadNextFiles({ indexDocument, snapshotPath }).map((filePath) => '- ' + filePath)
  ].join('\n') + '\n'

const getIsoWeekParts = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Context compressor expected a valid timestamp')
  }

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)

  return {
    year: utcDate.getUTCFullYear(),
    week: String(week).padStart(2, '0')
  }
}

const createAgentStudyContextCompressor = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  recentEventLimit = 8,
  eventLog = createAgentStudyEventLog({ studyRoot, fsImpl, now })
} = {}) => {
  const loadInputs = () => {
    const indexDocument = validateIndex(readJsonFile(fsImpl, path.join(studyRoot, 'index.json')))
    const currentState = validateCurrent(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'current.json')))
    const masteryState = validateMastery(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'mastery.json')))
    const reviewQueueState = validateReviewQueue(
      readJsonFile(fsImpl, path.join(studyRoot, 'state', 'review-queue.json'))
    )
    const previousContextPath = path.join(studyRoot, 'context', 'next-agent-context.md')
    const previousContext = fsImpl.existsSync(previousContextPath)
      ? fsImpl.readFileSync(previousContextPath, 'utf8')
      : ''

    const dailyPacket =
      typeof indexDocument.latest_daily === 'string' && indexDocument.latest_daily.trim() !== ''
        ? validateDailyPacket(
            readJsonFile(
              fsImpl,
              path.join(studyRoot, indexDocument.latest_daily.replace(/^study\//, ''))
            )
          )
        : null

    const reviewResult =
      typeof indexDocument.latest_review === 'string' && indexDocument.latest_review.trim() !== ''
        ? validateReviewResult(
            readJsonFile(
              fsImpl,
              path.join(studyRoot, indexDocument.latest_review.replace(/^study\//, ''))
            )
          )
        : null

    return {
      indexDocument,
      currentState,
      masteryState,
      reviewQueueState,
      previousContext,
      dailyPacket,
      reviewResult,
      recentEvents: eventLog.readRecentEvents(recentEventLimit)
    }
  }

  const compressContext = () => {
    const timestamp = now()
    const loaded = loadInputs()
    const weekParts = getIsoWeekParts(timestamp)
    const snapshotRelativePath = 'study/context/snapshots/' + weekParts.year + '-W' + weekParts.week + '-context.md'
    const snapshotAbsolutePath = path.join(
      studyRoot,
      'context',
      'snapshots',
      weekParts.year + '-W' + weekParts.week + '-context.md'
    )
    const nextContextAbsolutePath = path.join(studyRoot, 'context', 'next-agent-context.md')

    const snapshotContent = buildSnapshotContent({
      now: timestamp,
      ...loaded,
      snapshotPath: snapshotRelativePath
    })
    const compressedContext = buildCompressedContext({
      ...loaded,
      snapshotPath: snapshotRelativePath
    })

    if (loaded.previousContext && compressedContext.length >= loaded.previousContext.length) {
      throw new Error('Compressed context must be shorter than the prior next-agent-context')
    }

    atomicWriteText(fsImpl, snapshotAbsolutePath, snapshotContent)
    atomicWriteText(fsImpl, nextContextAbsolutePath, compressedContext)

    const event = eventLog.appendEvent({
      actor: 'codex',
      event: 'context_compressed',
      input_files: unique([
        'study/index.json',
        'study/context/next-agent-context.md',
        loaded.indexDocument.latest_daily,
        loaded.indexDocument.latest_review,
        'study/state/current.json',
        'study/state/mastery.json',
        'study/state/review-queue.json',
        'study/logs/agent-events.jsonl'
      ]),
      output_files: [
        snapshotRelativePath,
        'study/context/next-agent-context.md',
        'study/logs/agent-events.jsonl'
      ],
      summary:
        'Compressed next-agent-context from ' +
        (loaded.previousContext ? loaded.previousContext.length : 0) +
        ' chars to ' +
        compressedContext.length +
        ' chars.'
    })

    return {
      snapshot: {
        path: snapshotRelativePath,
        content: snapshotContent
      },
      nextAgentContext: {
        path: 'study/context/next-agent-context.md',
        content: compressedContext
      },
      event
    }
  }

  return {
    buildCompressedContext,
    buildSnapshotContent,
    compressContext
  }
}

export {
  buildCompressedContext,
  buildSnapshotContent,
  createAgentStudyContextCompressor
}
