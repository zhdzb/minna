import fs from 'fs'
import path from 'path'
import { validateCurrent, validateIndex, validateMastery, validateReviewQueue } from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const summarizeDueReviewItems = (reviewQueue) => {
  const dueItems = reviewQueue.items.filter((item) => item.status === 'due')
  if (dueItems.length === 0) {
    return 'No due review queue items right now.'
  }

  const summary = dueItems
    .slice(0, 3)
    .map((item) => item.key + ' (' + item.last_result + ', due ' + item.due_date + ')')
    .join('; ')

  return dueItems.length > 3 ? summary + '; +' + (dueItems.length - 3) + ' more.' : summary + '.'
}

const summarizeWeakGrammarPoints = (mastery) => {
  const weakPoints = Object.values(mastery.grammar_points)
    .filter((point) => point.status === 'weak' || point.status === 'learning')
    .sort((left, right) => left.controlled_output - right.controlled_output)
    .slice(0, 3)
    .map((point) => point.pattern + ' [' + point.status + ']')

  return weakPoints.length > 0 ? weakPoints.join(', ') : 'No weak grammar points highlighted.'
}

const summarizeRecentEvents = (recentEvents) => {
  if (recentEvents.length === 0) {
    return 'No recent event log entries.'
  }

  return recentEvents
    .slice(-3)
    .map((event) => event.time + ' ' + event.event)
    .join(' | ')
}

const buildNextReadFiles = ({ indexDocument }) =>
  unique([
    'study/index.json',
    'study/state/current.json',
    'study/state/mastery.json',
    'study/state/review-queue.json',
    'study/state/profile.json',
    indexDocument.latest_daily,
    indexDocument.latest_review,
    'study/logs/agent-events.jsonl'
  ])

const buildNextAgentContext = ({
  indexDocument,
  currentState,
  masteryState,
  reviewQueueState,
  recentEvents = []
}) => {
  const nextFiles = buildNextReadFiles({ indexDocument })
  const latestDailyPath = indexDocument.latest_daily || 'none'
  const latestReviewPath = indexDocument.latest_review || 'none'
  const latestPromptPath = indexDocument.latest_prompt || 'none'
  const activeGoals = currentState.active_goals.join(', ')
  const focusGrammar = currentState.recent_focus.grammar.join(', ')

  return [
    '# Next Agent Context',
    '',
    '## Current Snapshot',
    '- Current lesson: ' + currentState.current_lesson,
    '- Learning mode: ' + currentState.learning_mode,
    '- Active goals: ' + activeGoals,
    '- Latest daily: ' + latestDailyPath,
    '- Latest review: ' + latestReviewPath,
    '- Latest prompt: ' + latestPromptPath,
    '- Current gate: ' + masteryState.current_gate,
    '- Focus grammar: ' + focusGrammar,
    '- Weak grammar summary: ' + summarizeWeakGrammarPoints(masteryState),
    '- Due review queue: ' + summarizeDueReviewItems(reviewQueueState),
    '- Recent events: ' + summarizeRecentEvents(recentEvents),
    '',
    '## Next Action',
    '- Read the latest daily packet first and confirm whether the next move is create, submit follow-up, or review follow-up.',
    '- Re-check mastery and review queue before generating any new packet or advancing lesson state.',
    '- Keep outputs path-oriented and avoid copying full historical daily/review content into context.',
    '',
    '## Read Next',
    ...nextFiles.map((filePath) => '- ' + filePath)
  ].join('\n') + '\n'
}

const createAgentStudyContextWriter = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  recentEventLimit = 5
} = {}) => {
  const eventLog = createAgentStudyEventLog({ studyRoot, fsImpl, now })

  const loadInputs = () => {
    const indexDocument = validateIndex(readJsonFile(fsImpl, path.join(studyRoot, 'index.json')))
    const currentState = validateCurrent(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'current.json')))
    const masteryState = validateMastery(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'mastery.json')))
    const reviewQueueState = validateReviewQueue(
      readJsonFile(fsImpl, path.join(studyRoot, 'state', 'review-queue.json'))
    )

    return {
      indexDocument,
      currentState,
      masteryState,
      reviewQueueState,
      recentEvents: eventLog.readRecentEvents(recentEventLimit)
    }
  }

  const writeNextAgentContext = () => {
    const loaded = loadInputs()
    const content = buildNextAgentContext(loaded)
    const contextPath = path.join(studyRoot, 'context', 'next-agent-context.md')
    fsImpl.mkdirSync(path.dirname(contextPath), { recursive: true })
    fsImpl.writeFileSync(contextPath, content, 'utf8')
    return {
      path: path.posix.join('study', 'context', 'next-agent-context.md'),
      content
    }
  }

  return {
    buildNextAgentContext,
    writeNextAgentContext
  }
}

export { buildNextAgentContext, createAgentStudyContextWriter }
