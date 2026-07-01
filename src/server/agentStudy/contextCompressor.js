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
    .map(([key, point]) => `${key} -> ${point.pattern} [${point.status}]`)

  return weakPoints.length > 0 ? weakPoints : ['当前没有激活的薄弱语法点。']
}

const summarizeDueReviewItems = (reviewQueue) => {
  const dueItems = (reviewQueue.items || [])
    .filter((item) => item.status === 'due')
    .slice(0, 4)
    .map((item) => `${item.key} (${item.last_result}, due ${item.due_date})`)

  return dueItems.length > 0 ? dueItems : ['当前没有到期的复习队列项目。']
}

const summarizeReviewOutcome = (reviewResult) => {
  if (!reviewResult) {
    return ['当前 index 里还没有关联最新批改结果。']
  }

  return [
    `正确率：${Math.round(reviewResult.overall.accuracy * 100)}%`,
    `总结：${reviewResult.overall.summary}`,
    `下一步重点：${(reviewResult.overall.next_focus || []).join('、')}`,
    `建议重做题数：${reviewResult.items.filter((item) => item.retry_recommended).length}`
  ]
}

const summarizeDailyPacket = (dailyPacket) => {
  if (!dailyPacket) {
    return ['当前 index 里还没有关联最新学习包。']
  }

  return [
    `Daily ID：${dailyPacket.id}`,
    `状态：${dailyPacket.status}`,
    `任务主题：${dailyPacket.mission.title}`,
    `聚焦课程：${dailyPacket.mission.focus_lessons.join(', ')}`,
    `练习题数：${dailyPacket.exercises.length}`
  ]
}

const summarizeEvents = (recentEvents) => {
  if (!recentEvents.length) {
    return ['当前没有最近事件记录。']
  }

  return recentEvents.slice(-6).map((event) => {
    const inputCount = event.input_files.length
    const outputCount = event.output_files.length
    return `${event.time} ${event.event}（输入 ${inputCount} / 输出 ${outputCount}）`
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
    '# 上下文快照',
    '',
    `- 生成时间：${now}`,
    `- 快照路径：${snapshotPath}`,
    `- 旧 next-agent-context 长度：${previousContextLength} 字符`,
    `- 最新 daily 路径：${indexDocument.latest_daily || 'none'}`,
    `- 最新 review 路径：${indexDocument.latest_review || 'none'}`,
    `- 最新 prompt 路径：${indexDocument.latest_prompt || 'none'}`,
    '',
    '## 当前课程状态',
    `- 当前课程：${currentState.current_lesson}`,
    `- 学习模式：${currentState.learning_mode}`,
    `- 当前目标：${currentState.active_goals.join('、')}`,
    `- 当前 gate：${masteryState.current_gate}`,
    '',
    '## 薄弱点',
    ...summarizeWeakGrammarPoints(masteryState).map((line) => '- ' + line),
    '',
    '## 到期复习队列',
    ...summarizeDueReviewItems(reviewQueueState).map((line) => '- ' + line),
    '',
    '## 最新 Daily',
    ...summarizeDailyPacket(dailyPacket).map((line) => '- ' + line),
    '',
    '## 最新 Review',
    ...summarizeReviewOutcome(reviewResult).map((line) => '- ' + line),
    '',
    '## 最近事件',
    ...summarizeEvents(recentEvents).map((line) => '- ' + line),
    '',
    '## 后续优先读取',
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
    '# 下一次 Agent 上下文',
    '',
    '## 快照',
    '- ' + snapshotPath,
    '',
    '## 当前状态',
    `- 第 ${currentState.current_lesson} 课 · ${currentState.learning_mode} · gate ${masteryState.current_gate}`,
    `- Daily：${indexDocument.latest_daily || 'none'}`,
    `- Review：${indexDocument.latest_review || 'none'}`,
    `- 薄弱点：${summarizeWeakGrammarPoints(masteryState).slice(0, 2).join('；')}`,
    `- 到期复习：${summarizeDueReviewItems(reviewQueueState).slice(0, 2).join('；')}`,
    `- 当前重点：${reviewResult ? reviewResult.overall.next_focus.slice(0, 3).join('、') : '先读最新 review'}`,
    '',
    '## 下一步',
    '- 先读最新 daily 和 review。',
    '- 更完整的历史请回看 snapshot。',
    '- 调整课程状态前，重新检查 mastery 和 review queue。',
    '',
    '## 继续读取',
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
    const snapshotRelativePath = `study/context/snapshots/${weekParts.year}-W${weekParts.week}-context.md`
    const snapshotAbsolutePath = path.join(
      studyRoot,
      'context',
      'snapshots',
      `${weekParts.year}-W${weekParts.week}-context.md`
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
      summary: `Compressed next-agent-context from ${
        loaded.previousContext ? loaded.previousContext.length : 0
      } chars to ${compressedContext.length} chars.`
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
