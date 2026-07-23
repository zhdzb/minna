import fs from 'fs'
import path from 'path'
import { createAgentStudyEventLog } from '../agentStudy/eventLog.js'
import {
  LISTENING_LAB_SCHEMA_VERSION,
  validateListeningAttempt,
  validateListeningLabIndex,
  validateListeningProgress,
  validateListeningReviewQueue,
  validateListeningSession,
  validateListeningSourceSnapshot
} from '../../utils/listeningLabSchema.js'
import { buildListeningSourceSnapshot } from './sourceSnapshot.js'
import { buildListeningAttempt, buildListeningSession } from './sessionGenerator.js'

const INDEX_PATH = 'study/listening/index.json'
const PROGRESS_PATH = 'study/listening/state/progress.json'
const REVIEW_QUEUE_PATH = 'study/listening/state/review-queue.json'
const SOURCE_SNAPSHOT_PATH = 'study/listening/context/source-snapshot.json'
const NEXT_CONTEXT_PATH = 'study/listening/context/next-agent-context.md'
const EVENT_LOG_PATH = 'study/listening/logs/events.jsonl'

const clone = (value) => JSON.parse(JSON.stringify(value))
const toDateOnly = (value) => String(value || '').slice(0, 10)

const safeRemove = (fsImpl, filePath) => {
  try {
    fsImpl.unlinkSync(filePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const atomicWriteText = (fsImpl, filePath, content) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, content, 'utf8')
  safeRemove(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const atomicWriteJson = (fsImpl, filePath, value) =>
  atomicWriteText(fsImpl, filePath, JSON.stringify(value, null, 2) + '\n')

const readJson = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const addDays = (dateValue, days) => {
  const date = new Date(toDateOnly(dateValue) + 'T00:00:00.000Z')
  if (Number.isNaN(date.getTime())) throw new Error('Listening Lab requires a valid date')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const normalizeAnswer = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s。、，,.!?！？]/g, '')

const createEmptyIndex = (timestamp) => ({
  schema_version: LISTENING_LAB_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  latest_session: '',
  latest_attempt: '',
  sessions: []
})

const createEmptyProgress = (timestamp) => ({
  schema_version: LISTENING_LAB_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  total_attempts: 0,
  completed_attempts: 0,
  comprehension_correct: 0,
  comprehension_total: 0,
  average_accuracy: 0,
  shadowing_completed_segments: 0,
  shadowing_total_segments: 0,
  average_shadowing_rating: 0,
  workplace_response_count: 0,
  scenario_counts: {},
  recent_focus: []
})

const createEmptyReviewQueue = (timestamp) => ({
  schema_version: LISTENING_LAB_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  items: []
})

const buildFeedback = ({ session, attempt }) => {
  const questionResults = session.comprehension.questions.map((question) => {
    const userAnswer = String(attempt.answers[question.id] || '').trim()
    const normalizedUserAnswer = normalizeAnswer(userAnswer)
    const acceptableValues = [
      question.answer_reference,
      ...question.accepted_keywords
    ].map(normalizeAnswer)
    const isCorrect =
      normalizedUserAnswer !== '' &&
      acceptableValues.some(
        (candidate) =>
          normalizedUserAnswer === candidate ||
          normalizedUserAnswer.includes(candidate) ||
          candidate.includes(normalizedUserAnswer)
      )

    return {
      question_id: question.id,
      prompt_zh: question.prompt_zh,
      user_answer: userAnswer,
      is_correct: isCorrect,
      answer_reference: question.answer_reference,
      explanation_zh: question.explanation_zh,
      segment_ids: question.segment_ids
    }
  })
  const correctCount = questionResults.filter((item) => item.is_correct).length
  const totalCount = questionResults.length
  const accuracy = totalCount ? Number((correctCount / totalCount).toFixed(4)) : 0
  const retrySegmentIds = Array.from(
    new Set(
      questionResults
        .filter((item) => !item.is_correct)
        .flatMap((item) => item.segment_ids)
        .concat(attempt.reflection.difficult_segment_ids)
    )
  )
  const incompleteShadowing = attempt.shadowing
    .filter((item) => !item.completed)
    .map((item) => item.segment_id)
  const nextFocus = []
  if (accuracy < 0.8) nextFocus.push('重听关键信息并核对时间、地点和动作关系')
  if (incompleteShadowing.length) nextFocus.push('完成尚未跟读的句段')
  if (!String(attempt.response_answer || '').trim()) {
    nextFocus.push('完成一次不看原文的职场回应')
  }
  if (!nextFocus.length) nextFocus.push('三天后用正常语速复听并再次跟读')

  return {
    accuracy,
    correct_count: correctCount,
    total_count: totalCount,
    summary_zh:
      accuracy >= 0.8
        ? '主要信息理解稳定，可以把重点转向正常语速下的停顿、节奏和职场回应。'
        : '主旨已经建立，但部分关键信息仍需重听。先集中重练标记句段，再回到完整音频。',
    question_results: questionResults,
    retry_segment_ids: Array.from(new Set([...retrySegmentIds, ...incompleteShadowing])),
    next_focus: nextFocus
  }
}

const buildPromptSnapshot = ({ session, sourceSnapshot }) => `# 听读跟读生成记录

## 模块边界

- 本记录只属于 Listening Lab，不属于 daily packet 或普通 review。
- 生成时允许只读参考 Agent Study 的压缩学习信号。
- 提交结果只写入 \`study/listening/\`。

## 输入快照

- 快照：${sourceSnapshot.id}
- 当前课次：第 ${sourceSnapshot.current_lesson} 课
- 聚焦课次：${sourceSnapshot.focus_lessons.join('、')}
- 语法重点：${sourceSnapshot.grammar_focus.join('；') || '无'}
- 听说重点：${sourceSnapshot.listening_focus.join('；') || '无'}
- 错因信号：${sourceSnapshot.mistake_signals.map((item) => `${item.tag}×${item.count}`).join('、') || '无'}
- 词汇 ID：${sourceSnapshot.vocabulary_targets.map((item) => item.id).join('、')}

## 输出

- Session：${session.id}
- 场景：${session.plan.scenario_label}
- 等级：${session.plan.level}
- 目标：${session.plan.goals.join('；')}

生成内容遵守“先盲听、后文本、再跟读和应答”的顺序。人名附假名且不作为评分目标。
`

const buildNextContext = ({ index, progress, reviewQueue, sourceSnapshot }) => `# Listening Lab Next Context

这是“听读跟读”模块的独立上下文。不要读取或修改普通 daily packet、review 或 Agent Study 上下文。

## 当前状态

- 最新 session：${index.latest_session || '无'}
- 最新 attempt：${index.latest_attempt || '无'}
- 已完成训练：${progress.completed_attempts}
- 平均理解正确率：${Math.round(progress.average_accuracy * 100)}%
- 模块内待复习：${reviewQueue.items.filter((item) => item.status === 'due').length}

## 只读学习信号

- 来源快照：${SOURCE_SNAPSHOT_PATH}
- 当前课次：第 ${sourceSnapshot.current_lesson} 课
- 聚焦课次：${sourceSnapshot.focus_lessons.join('、')}
- 目标词：${sourceSnapshot.vocabulary_targets.map((item) => `${item.word}（${item.kana}）`).join('、')}

## 下一次生成约束

1. 使用独立模板 \`study/listening/prompts/templates/generate-session.md\`。
2. 只读取 source snapshot 中的压缩信号，不复制完整错题、词表或 daily packet。
3. 归档 session、attempt、反馈、复习队列和日志时只写入 \`study/listening/\`。
4. 保持职场实用内容优先，同时兼顾 JLPT 听读理解。
`

const createListeningLabStore = ({
  root = path.resolve(process.cwd(), 'study', 'listening'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  sourceSnapshotBuilder = buildListeningSourceSnapshot,
  eventLog = null
} = {}) => {
  const listeningEventLog =
    eventLog ||
    createAgentStudyEventLog({
      studyRoot: root,
      fsImpl,
      now,
      logRelativePath: 'study/logs/events.jsonl'
    })
  const resolveRelative = (relativePath) => {
    const absolutePath = path.resolve(root, relativePath)
    const relative = path.relative(root, absolutePath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Listening Lab path must stay inside its data root')
    }
    return absolutePath
  }

  const toProjectPath = (relativePath) =>
    'study/listening/' + String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '')

  const readOrCreate = ({ relativePath, validator, factory }) => {
    const filePath = resolveRelative(relativePath)
    if (!fsImpl.existsSync(filePath)) {
      const created = validator(factory(now()))
      atomicWriteJson(fsImpl, filePath, created)
      return created
    }
    return validator(readJson(fsImpl, filePath))
  }

  const loadIndex = () =>
    readOrCreate({
      relativePath: 'index.json',
      validator: validateListeningLabIndex,
      factory: createEmptyIndex
    })

  const loadProgress = () =>
    readOrCreate({
      relativePath: path.join('state', 'progress.json'),
      validator: validateListeningProgress,
      factory: createEmptyProgress
    })

  const loadReviewQueue = () =>
    readOrCreate({
      relativePath: path.join('state', 'review-queue.json'),
      validator: validateListeningReviewQueue,
      factory: createEmptyReviewQueue
    })

  const writeIndex = (value) => {
    const validated = validateListeningLabIndex(value)
    atomicWriteJson(fsImpl, resolveRelative('index.json'), validated)
    return validated
  }

  const writeProgress = (value) => {
    const validated = validateListeningProgress(value)
    atomicWriteJson(fsImpl, resolveRelative(path.join('state', 'progress.json')), validated)
    return validated
  }

  const writeReviewQueue = (value) => {
    const validated = validateListeningReviewQueue(value)
    atomicWriteJson(
      fsImpl,
      resolveRelative(path.join('state', 'review-queue.json')),
      validated
    )
    return validated
  }

  const loadSessionByPath = (projectPath) => {
    if (!projectPath) return null
    const relative = projectPath.replace(/^study\/listening\//, '')
    return validateListeningSession(readJson(fsImpl, resolveRelative(relative)))
  }

  const loadAttemptByPath = (projectPath) => {
    if (!projectPath) return null
    const relative = projectPath.replace(/^study\/listening\//, '')
    return validateListeningAttempt(readJson(fsImpl, resolveRelative(relative)))
  }

  const loadDashboard = () => {
    const index = loadIndex()
    const progress = loadProgress()
    const reviewQueue = loadReviewQueue()
    const today = toDateOnly(now())
    reviewQueue.items = reviewQueue.items.map((item) => ({
      ...item,
      status: item.status === 'scheduled' && item.due_date <= today ? 'due' : item.status
    }))
    return {
      index,
      progress,
      reviewQueue,
      latestSession: loadSessionByPath(index.latest_session),
      latestAttempt: loadAttemptByPath(index.latest_attempt),
      history: index.sessions.slice().reverse()
    }
  }

  const writeSourceContext = ({ sourceSnapshot, index, progress, reviewQueue }) => {
    atomicWriteJson(
      fsImpl,
      resolveRelative(path.join('context', 'source-snapshot.json')),
      validateListeningSourceSnapshot(sourceSnapshot)
    )
    atomicWriteText(
      fsImpl,
      resolveRelative(path.join('context', 'next-agent-context.md')),
      buildNextContext({ index, progress, reviewQueue, sourceSnapshot })
    )
  }

  const generateSession = ({ scenarioId = '' } = {}) => {
    const timestamp = now()
    const date = toDateOnly(timestamp)
    const index = loadIndex()
    const progress = loadProgress()
    const reviewQueue = loadReviewQueue()
    const sourceSnapshot = sourceSnapshotBuilder({ now: () => timestamp })
    const sequence = index.sessions.length
    const daySequence =
      index.sessions.filter((entry) => entry.date === date).length + 1
    const id = 'listening-' + date + '-' + String(daySequence).padStart(2, '0')
    const session = buildListeningSession({
      id,
      date,
      timestamp,
      sequence,
      scenarioId,
      sourceSnapshot
    })
    const attempt = buildListeningAttempt({
      session,
      attemptNumber: 1,
      timestamp
    })
    const sessionRelative = path.join('sessions', id + '.json')
    const attemptRelative = path.join('attempts', attempt.id + '.json')
    atomicWriteJson(fsImpl, resolveRelative(sessionRelative), session)
    atomicWriteJson(fsImpl, resolveRelative(attemptRelative), attempt)
    atomicWriteText(
      fsImpl,
      resolveRelative(path.join('prompts', 'generated', id + '.md')),
      buildPromptSnapshot({ session, sourceSnapshot })
    )

    const nextIndex = writeIndex({
      ...index,
      revision: index.revision + 1,
      updated_at: timestamp,
      latest_session: toProjectPath(sessionRelative),
      latest_attempt: toProjectPath(attemptRelative),
      sessions: [
        ...index.sessions,
        {
          id,
          date,
          title: session.plan.title,
          scenario: session.plan.scenario_label,
          status: 'in_progress',
          session_file: toProjectPath(sessionRelative),
          attempt_file: toProjectPath(attemptRelative),
          accuracy: null,
          updated_at: timestamp
        }
      ]
    })
    writeSourceContext({
      sourceSnapshot,
      index: nextIndex,
      progress,
      reviewQueue
    })
    listeningEventLog.appendEvent({
      actor: 'frontend',
      event: 'listening_session_generated',
      input_files: [
        'study/state/current.json',
        'study/state/mastery.json',
        'study/state/mistakes.json',
        'study/state/vocabulary-progress.json'
      ],
      output_files: [
        toProjectPath(sessionRelative),
        toProjectPath(attemptRelative),
        SOURCE_SNAPSHOT_PATH,
        NEXT_CONTEXT_PATH,
        EVENT_LOG_PATH
      ],
      summary: 'Generated an independent Listening Lab session from a compact read-only learning snapshot.'
    })
    return loadDashboard()
  }

  const writeAttempt = ({ attempt, statusOverride = null }) => {
    const incoming = validateListeningAttempt(clone(attempt))
    const attemptRelative = path.join('attempts', incoming.id + '.json')
    const absolutePath = resolveRelative(attemptRelative)
    if (!fsImpl.existsSync(absolutePath)) {
      throw new Error('Listening attempt not found: ' + incoming.id)
    }
    const existing = validateListeningAttempt(readJson(fsImpl, absolutePath))
    if (incoming.revision !== existing.revision) {
      throw new Error(
        'Revision conflict for listening attempt ' +
          incoming.id +
          ': expected ' +
          existing.revision +
          ' but received ' +
          incoming.revision
      )
    }
    if (existing.status === 'submitted') return existing
    const timestamp = now()
    const next = validateListeningAttempt({
      ...incoming,
      status: statusOverride || incoming.status,
      revision: existing.revision + 1,
      updated_at: timestamp
    })
    atomicWriteJson(fsImpl, absolutePath, next)
    return next
  }

  const saveAttempt = ({ attempt }) => {
    const savedAttempt = writeAttempt({ attempt })
    const index = loadIndex()
    const nextIndex = writeIndex({
      ...index,
      revision: index.revision + 1,
      updated_at: savedAttempt.updated_at,
      latest_attempt: toProjectPath(path.join('attempts', savedAttempt.id + '.json')),
      sessions: index.sessions.map((entry) =>
        entry.id === savedAttempt.session_id
          ? {
              ...entry,
              status: savedAttempt.status,
              attempt_file: toProjectPath(
                path.join('attempts', savedAttempt.id + '.json')
              ),
              updated_at: savedAttempt.updated_at
            }
          : entry
      )
    })
    listeningEventLog.appendEvent({
      actor: 'frontend',
      event: 'listening_attempt_saved',
      input_files: [nextIndex.latest_session, nextIndex.latest_attempt],
      output_files: [nextIndex.latest_attempt, INDEX_PATH, EVENT_LOG_PATH],
      summary: 'Saved Listening Lab attempt progress.'
    })
    return loadDashboard()
  }

  const submitAttempt = ({ attempt }) => {
    const incoming = validateListeningAttempt(clone(attempt))
    const index = loadIndex()
    const sessionEntry = index.sessions.find((entry) => entry.id === incoming.session_id)
    if (!sessionEntry) throw new Error('Listening session not found: ' + incoming.session_id)
    const session = loadSessionByPath(sessionEntry.session_file)
    const timestamp = now()
    const feedback = buildFeedback({ session, attempt: incoming })
    const submitted = writeAttempt({
      attempt: {
        ...incoming,
        status: 'submitted',
        submitted_at: timestamp,
        current_stage: 'feedback',
        transcript_revealed: true,
        feedback
      },
      statusOverride: 'submitted'
    })

    const progress = loadProgress()
    const completedShadowing = submitted.shadowing.filter((item) => item.completed)
    const ratings = completedShadowing
      .map((item) => item.self_rating)
      .filter((rating) => Number.isInteger(rating))
    const previousRatingCount = progress.shadowing_completed_segments
    const nextRatingTotal =
      progress.average_shadowing_rating * previousRatingCount +
      ratings.reduce((sum, rating) => sum + rating, 0)
    const nextRatingCount = previousRatingCount + ratings.length
    const nextCompletedCount = progress.completed_attempts + 1
    const nextProgress = writeProgress({
      ...progress,
      revision: progress.revision + 1,
      updated_at: timestamp,
      total_attempts: progress.total_attempts + 1,
      completed_attempts: nextCompletedCount,
      comprehension_correct: progress.comprehension_correct + feedback.correct_count,
      comprehension_total: progress.comprehension_total + feedback.total_count,
      average_accuracy: Number(
        (
          (progress.average_accuracy * progress.completed_attempts + feedback.accuracy) /
          nextCompletedCount
        ).toFixed(4)
      ),
      shadowing_completed_segments:
        progress.shadowing_completed_segments + completedShadowing.length,
      shadowing_total_segments:
        progress.shadowing_total_segments + submitted.shadowing.length,
      average_shadowing_rating: nextRatingCount
        ? Number((nextRatingTotal / nextRatingCount).toFixed(4))
        : progress.average_shadowing_rating,
      workplace_response_count:
        progress.workplace_response_count +
        Number(Boolean(String(submitted.response_answer || '').trim())),
      scenario_counts: {
        ...progress.scenario_counts,
        [session.plan.scenario_id]:
          Number(progress.scenario_counts[session.plan.scenario_id] || 0) + 1
      },
      recent_focus: feedback.next_focus
    })

    const queue = loadReviewQueue()
    const queueId = 'listening-review:' + session.id
    const needsSoon =
      feedback.accuracy < 0.8 || completedShadowing.length < submitted.shadowing.length
    const queueItem = {
      id: queueId,
      session_id: session.id,
      status: 'scheduled',
      due_date: addDays(timestamp, needsSoon ? 1 : 3),
      reason: needsSoon
        ? '理解或跟读仍有未完成项，建议短间隔重练。'
        : '理解稳定，安排一次正常语速巩固。',
      focus_segment_ids: feedback.retry_segment_ids,
      last_accuracy: feedback.accuracy,
      updated_at: timestamp
    }
    const existingQueueIndex = queue.items.findIndex((item) => item.id === queueId)
    const nextQueueItems = queue.items.slice()
    if (existingQueueIndex >= 0) nextQueueItems[existingQueueIndex] = queueItem
    else nextQueueItems.push(queueItem)
    const nextQueue = writeReviewQueue({
      ...queue,
      revision: queue.revision + 1,
      updated_at: timestamp,
      items: nextQueueItems
    })

    const nextIndex = writeIndex({
      ...index,
      revision: index.revision + 1,
      updated_at: timestamp,
      latest_attempt: toProjectPath(path.join('attempts', submitted.id + '.json')),
      sessions: index.sessions.map((entry) =>
        entry.id === session.id
          ? {
              ...entry,
              status: 'submitted',
              attempt_file: toProjectPath(path.join('attempts', submitted.id + '.json')),
              accuracy: feedback.accuracy,
              updated_at: timestamp
            }
          : entry
      )
    })
    let sourceSnapshot
    try {
      sourceSnapshot = validateListeningSourceSnapshot(
        readJson(fsImpl, resolveRelative(path.join('context', 'source-snapshot.json')))
      )
    } catch (_error) {
      sourceSnapshot = sourceSnapshotBuilder({ now: () => timestamp })
    }
    writeSourceContext({
      sourceSnapshot,
      index: nextIndex,
      progress: nextProgress,
      reviewQueue: nextQueue
    })
    listeningEventLog.appendEvent({
      actor: 'frontend',
      event: 'listening_attempt_submitted',
      input_files: [sessionEntry.session_file, sessionEntry.attempt_file],
      output_files: [
        toProjectPath(path.join('attempts', submitted.id + '.json')),
        PROGRESS_PATH,
        REVIEW_QUEUE_PATH,
        INDEX_PATH,
        EVENT_LOG_PATH
      ],
      summary: 'Submitted Listening Lab attempt and updated only the module progress and review queue.'
    })
    return loadDashboard()
  }

  const retrySession = ({ sessionId }) => {
    const index = loadIndex()
    const entry = index.sessions.find((item) => item.id === sessionId)
    if (!entry) throw new Error('Listening session not found: ' + sessionId)
    const session = loadSessionByPath(entry.session_file)
    const attemptsDirectory = resolveRelative('attempts')
    const attemptCount = fsImpl.existsSync(attemptsDirectory)
      ? fsImpl
          .readdirSync(attemptsDirectory)
          .filter((name) => name.startsWith(session.id + '-attempt-') && name.endsWith('.json'))
          .length
      : 0
    const timestamp = now()
    const attempt = buildListeningAttempt({
      session,
      attemptNumber: attemptCount + 1,
      timestamp
    })
    const attemptRelative = path.join('attempts', attempt.id + '.json')
    atomicWriteJson(fsImpl, resolveRelative(attemptRelative), attempt)
    const nextIndex = writeIndex({
      ...index,
      revision: index.revision + 1,
      updated_at: timestamp,
      latest_session: entry.session_file,
      latest_attempt: toProjectPath(attemptRelative),
      sessions: index.sessions.map((item) =>
        item.id === session.id
          ? {
              ...item,
              status: 'in_progress',
              attempt_file: toProjectPath(attemptRelative),
              accuracy: null,
              updated_at: timestamp
            }
          : item
      )
    })
    listeningEventLog.appendEvent({
      actor: 'frontend',
      event: 'listening_session_retried',
      input_files: [entry.session_file],
      output_files: [nextIndex.latest_attempt, INDEX_PATH, EVENT_LOG_PATH],
      summary: 'Created a fresh attempt for an archived Listening Lab session.'
    })
    return loadDashboard()
  }

  const saveRecording = ({ attemptId, segmentId, dataUrl }) => {
    if (!/^[a-zA-Z0-9-]+$/.test(attemptId) || !/^[a-zA-Z0-9-]+$/.test(segmentId)) {
      throw new Error('Recording identifiers contain unsupported characters')
    }
    const match = String(dataUrl || '').match(
      /^data:(audio\/(?:webm|ogg|mp4|wav|mpeg));base64,([a-zA-Z0-9+/=]+)$/
    )
    if (!match) throw new Error('Recording must be a supported base64 audio data URL')
    const mimeType = match[1]
    const buffer = Buffer.from(match[2], 'base64')
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
      throw new Error('Recording must be between 1 byte and 8 MB')
    }
    const extensionByMime = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'mp4',
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3'
    }
    const attemptPath = resolveRelative(path.join('attempts', attemptId + '.json'))
    if (!fsImpl.existsSync(attemptPath)) throw new Error('Listening attempt not found: ' + attemptId)
    const attempt = validateListeningAttempt(readJson(fsImpl, attemptPath))
    const shadowingIndex = attempt.shadowing.findIndex((item) => item.segment_id === segmentId)
    if (shadowingIndex < 0) throw new Error('Listening segment not found: ' + segmentId)
    const relativePath = path.join(
      'audio',
      attempt.session_id,
      attemptId + '-' + segmentId + '.' + extensionByMime[mimeType]
    )
    const absolutePath = resolveRelative(relativePath)
    fsImpl.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fsImpl.writeFileSync(absolutePath, buffer)
    const timestamp = now()
    const nextAttempt = clone(attempt)
    nextAttempt.revision += 1
    nextAttempt.updated_at = timestamp
    nextAttempt.shadowing[shadowingIndex] = {
      ...nextAttempt.shadowing[shadowingIndex],
      recording_file: toProjectPath(relativePath),
      recorded_at: timestamp
    }
    atomicWriteJson(fsImpl, attemptPath, validateListeningAttempt(nextAttempt))
    listeningEventLog.appendEvent({
      actor: 'frontend',
      event: 'listening_recording_saved',
      input_files: [toProjectPath(path.join('attempts', attemptId + '.json'))],
      output_files: [
        toProjectPath(relativePath),
        toProjectPath(path.join('attempts', attemptId + '.json')),
        EVENT_LOG_PATH
      ],
      summary: 'Archived a Listening Lab shadowing recording.'
    })
    return loadDashboard()
  }

  const resolveRecording = (projectPath) => {
    const prefix = 'study/listening/audio/'
    if (typeof projectPath !== 'string' || !projectPath.startsWith(prefix)) {
      throw new Error('Recording path must point inside study/listening/audio')
    }
    const relativePath = projectPath.slice('study/listening/'.length)
    const absolutePath = resolveRelative(relativePath)
    if (!fsImpl.existsSync(absolutePath)) throw new Error('Recording file not found')
    const extension = path.extname(absolutePath).toLowerCase()
    const mimeTypes = {
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp4': 'audio/mp4',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg'
    }
    return {
      absolutePath,
      mimeType: mimeTypes[extension] || 'application/octet-stream'
    }
  }

  return {
    generateSession,
    loadAttemptByPath,
    loadDashboard,
    loadIndex,
    loadProgress,
    loadReviewQueue,
    loadSessionByPath,
    resolveRecording,
    retrySession,
    saveAttempt,
    saveRecording,
    submitAttempt
  }
}

export {
  EVENT_LOG_PATH,
  INDEX_PATH,
  NEXT_CONTEXT_PATH,
  PROGRESS_PATH,
  REVIEW_QUEUE_PATH,
  SOURCE_SNAPSHOT_PATH,
  buildFeedback,
  createListeningLabStore
}
