import fs from 'fs'
import path from 'path'
import { validateCurrent, validateIndex, validateMastery, validateReviewQueue } from '../../utils/agentStudySchema.js'
import { createAgentStudyEventLog } from './eventLog.js'

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const summarizeDueReviewItems = (reviewQueue) => {
  const dueItems = reviewQueue.items.filter((item) => item.status === 'due')
  if (dueItems.length === 0) {
    return '当前没有到期的复习队列项目。'
  }

  const summary = dueItems
    .slice(0, 3)
    .map((item) => item.key + ' (' + item.last_result + ', due ' + item.due_date + ')')
    .join('; ')

  return dueItems.length > 3 ? summary + '；另外还有 ' + (dueItems.length - 3) + ' 项。' : summary + '。'
}

const summarizeWeakGrammarPoints = (mastery) => {
  const weakPoints = Object.values(mastery.grammar_points)
    .filter((point) => point.status === 'weak' || point.status === 'learning')
    .sort((left, right) => left.controlled_output - right.controlled_output)
    .slice(0, 3)
    .map((point) => point.pattern + ' [' + point.status + ']')

  return weakPoints.length > 0 ? weakPoints.join('、') : '当前没有特别标记的薄弱语法点。'
}

const summarizeRecentEvents = (recentEvents) => {
  if (recentEvents.length === 0) {
    return '当前没有最近事件记录。'
  }

  return recentEvents
    .slice(-3)
    .map((event) => event.time + ' ' + event.event)
    .join(' | ')
}

const summarizeVocabularySelection = (selection) => {
  const items = Array.isArray(selection?.items) ? selection.items : []
  if (items.length === 0) return '尚未生成下一轮词汇选择。'
  const terms = items.slice(0, 8).map((item) => `${item.word}（${item.kana}）`)
  const remaining = items.length - terms.length
  return `${terms.join('、')}${remaining > 0 ? `；另有 ${remaining} 个词` : ''}。`
}

const buildNextReadFiles = ({ indexDocument }) =>
  unique([
    'study/index.json',
    'study/state/current.json',
    'study/state/mastery.json',
    'study/state/review-queue.json',
    'study/state/profile.json',
    'study/context/vocabulary-selection.json',
    indexDocument.latest_daily,
    indexDocument.latest_prompt,
    indexDocument.latest_review,
    'study/logs/agent-events.jsonl'
  ])

const buildNextAgentContext = ({
  indexDocument,
  currentState,
  masteryState,
  reviewQueueState,
  vocabularySelection = null,
  recentEvents = []
}) => {
  const nextFiles = buildNextReadFiles({ indexDocument })
  const latestDailyPath = indexDocument.latest_daily || 'none'
  const latestReviewPath = indexDocument.latest_review || 'none'
  const latestPromptPath = indexDocument.latest_prompt || 'none'
  const activeGoals = currentState.active_goals.join(', ')
  const focusGrammar = currentState.recent_focus.grammar.join(', ')

  return [
    '# 下一次 Agent 上下文',
    '',
    '## 当前快照',
    '- 当前课程：' + currentState.current_lesson,
    '- 学习模式：' + currentState.learning_mode,
    '- 当前目标：' + activeGoals,
    '- 最新 daily：' + latestDailyPath,
    '- 最新 review：' + latestReviewPath,
    '- 最新 prompt：' + latestPromptPath,
    '- 当前 gate：' + masteryState.current_gate,
    '- 重点语法：' + focusGrammar,
    '- 薄弱语法摘要：' + summarizeWeakGrammarPoints(masteryState),
    '- 到期复习队列：' + summarizeDueReviewItems(reviewQueueState),
    '- 下一轮目标词：' + summarizeVocabularySelection(vocabularySelection),
    '- 最近事件：' + summarizeRecentEvents(recentEvents),
    '',
    '## 下一步动作',
    '- 先读最新的 daily packet，确认下一步是创建新包、继续提交后的跟进，还是继续批改后的跟进。',
    '- 生成任何新 packet 或推进课程状态前，重新检查 mastery 和 review queue。',
    '- 出题只读取 study/context/vocabulary-selection.json 中的小批目标词，不要把整本词库复制进上下文。',
    '- 上下文只保留路径和摘要，不要把历史 daily/review 全文复制进来。',
    '',
    '## 接下来先读',
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
    const vocabularySelectionPath = path.join(studyRoot, 'context', 'vocabulary-selection.json')
    const vocabularySelection = fsImpl.existsSync(vocabularySelectionPath)
      ? readJsonFile(fsImpl, vocabularySelectionPath)
      : null

    return {
      indexDocument,
      currentState,
      masteryState,
      reviewQueueState,
      vocabularySelection,
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
