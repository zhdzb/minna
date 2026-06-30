import {
  validateCurrent,
  validateMastery,
  validateReviewQueue
} from '../../utils/agentStudySchema.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const clampScore = (value) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric)) {
    return 0
  }

  return Number(Math.max(0, Math.min(1, numeric)).toFixed(4))
}

const unique = (values) => Array.from(new Set(values.filter(Boolean)))

const formatDateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

const slugifyText = (value) => {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalized) {
    return normalized
  }

  const fallback = Buffer.from(String(value || ''), 'utf8').toString('base64url').toLowerCase()
  return fallback.slice(0, 20) || 'item'
}

const normalizePattern = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, '')

const parseLegacyData = (input) => {
  if (typeof input === 'string') {
    return JSON.parse(input)
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Legacy study data must be a JSON string or plain object')
  }

  return clone(input)
}

const deriveLessonStatus = ({ rate, questionCount }) => {
  if (rate >= 0.85 && questionCount >= 15) return 'mastered'
  if (rate >= 0.7) return 'stabilizing'
  if (rate >= 0.45) return 'learning'
  return 'weak'
}

const deriveLessonSkillScores = ({ rate, lesson, currentLesson }) => {
  const isCurrentLesson = lesson === currentLesson
  const grammar = clampScore(rate)
  const reading = clampScore(Math.min(1, rate + (rate >= 0.55 ? 0.05 : 0)))
  const listeningPenalty = isCurrentLesson ? 0.18 : 0.12
  const speakingPenalty = isCurrentLesson ? 0.22 : 0.15

  return {
    grammar,
    listening: clampScore(Math.max(0, rate - listeningPenalty)),
    speaking: clampScore(Math.max(0, rate - speakingPenalty)),
    reading
  }
}

const buildLessonStateKey = (lesson) => 'lesson-' + lesson

const resolveGrammarPointKey = ({ lesson, pattern, existingMastery }) => {
  const normalizedPattern = normalizePattern(pattern)

  if (lesson === 7 && normalizedPattern.includes('でv')) {
    return 'lesson-7/tool-means'
  }

  if (lesson === 7 && normalizedPattern.includes('あげ')) {
    return 'lesson-7/ageru'
  }

  if (lesson === 7 && normalizedPattern.includes('もら')) {
    return 'lesson-7/morau'
  }

  if (normalizedPattern.includes('なければ') && normalizedPattern.includes('なりません')) {
    return 'lesson-' + lesson + '/nakereba-narimasen'
  }

  const existingMatch = Object.entries(existingMastery.grammar_points || {}).find(([, point]) => {
    return point.lesson === lesson && normalizePattern(point.pattern) === normalizedPattern
  })
  if (existingMatch) {
    return existingMatch[0]
  }

  return 'lesson-' + lesson + '/' + slugifyText(pattern)
}

const buildLegacyMistakeBuckets = (legacyData) => {
  const mistakes = Array.isArray(legacyData.mistakes_book) ? legacyData.mistakes_book : []
  const buckets = new Map()

  for (const item of mistakes) {
    if (item.mark_type !== 'mistake') {
      continue
    }

    const lesson = Number(item.lesson)
    if (!Number.isInteger(lesson)) {
      continue
    }

    const rawGrammarKey = item.grammar_point || item.question_type || 'legacy-mistake'
    const bucketKey = lesson + '::' + rawGrammarKey
    const current = buckets.get(bucketKey) || {
      lesson,
      grammar_point: rawGrammarKey,
      count: 0,
      latest: null,
      examples: []
    }

    current.count += 1
    current.examples.push(item)
    if (!current.latest || String(item.timestamp || '') > String(current.latest.timestamp || '')) {
      current.latest = item
    }

    buckets.set(bucketKey, current)
  }

  return Array.from(buckets.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count
    return String(right.latest?.timestamp || '').localeCompare(String(left.latest?.timestamp || ''))
  })
}

const buildWeaknessSummary = ({ legacyData, currentLesson, mistakeBuckets, currentState }) => {
  const lessonStats = legacyData.progress?.lesson_stats || {}
  const currentLessonStat = lessonStats[String(currentLesson)]
  const patternEntries = Object.entries(legacyData.pattern_mastery || {}).filter(
    ([, patternState]) => Number(patternState.lesson) === currentLesson
  )

  const summary = []

  if (currentLessonStat) {
    summary.push({
      scope: 'lesson',
      key: String(currentLesson),
      problem:
        '最近一次第 ' +
        currentLesson +
        ' 课练习正确率只有 ' +
        Math.round((currentLessonStat.last_correct_rate || 0) * 100) +
        '%，需要先重建基础输出。',
      evidence: ['data.json:progress.lesson_stats.' + currentLesson]
    })
  }

  for (const [pattern, patternState] of patternEntries) {
    if (summary.length >= 2) break
    summary.push({
      scope: 'grammar_point',
      key: resolveGrammarPointKey({
        lesson: currentLesson,
        pattern,
        existingMastery: { grammar_points: {} }
      }),
      problem:
        '第 ' +
        currentLesson +
        ' 课句型「' +
        pattern +
        '」输出分接近 0，需要重新做替换和造句训练。',
      evidence: ['data.json:pattern_mastery.' + pattern]
    })
  }

  for (const bucket of mistakeBuckets) {
    if (summary.length >= 4) break
    const latest = bucket.latest || {}
    summary.push({
      scope: 'legacy_mistake',
      key: 'lesson-' + bucket.lesson + '/' + slugifyText(bucket.grammar_point),
      problem:
        '历史错题中第 ' +
        bucket.lesson +
        ' 课「' +
        bucket.grammar_point +
        '」累计出错 ' +
        bucket.count +
        ' 次，需要回收复习。',
      evidence: unique([
        latest.id ? 'data.json:mistakes_book#' + latest.id : null,
        latest.timestamp ? 'data.json:mistakes_book@' + latest.timestamp : null
      ])
    })
  }

  return summary.length > 0 ? summary.slice(0, 4) : currentState.weakness_summary
}

const mergeCurrentState = ({ legacyData, currentState, now }) => {
  const lessonStats = legacyData.progress?.lesson_stats || {}
  const currentLesson = Number(legacyData.progress?.current_lesson) || currentState.current_lesson
  const currentLessonStat = lessonStats[String(currentLesson)]
  const mistakeBuckets = buildLegacyMistakeBuckets(legacyData)
  const recentMistakeGrammar = mistakeBuckets
    .map((bucket) => bucket.grammar_point)
    .filter((value) => value && !/^q_/.test(value))
    .slice(0, 2)
  const legacyPatterns = Object.keys(legacyData.pattern_mastery || {})

  const nextCurrent = clone(currentState)
  nextCurrent.revision = currentState.revision + 1
  nextCurrent.updated_at = now
  nextCurrent.current_lesson = currentLesson
  nextCurrent.learning_mode =
    currentLessonStat && (currentLessonStat.last_correct_rate || 0) < 0.5
      ? 'foundation_rebuild'
      : currentState.learning_mode
  nextCurrent.active_goals = [
    '重建第 ' + currentLesson + ' 课输出能力',
    '回收历史错题复习队列'
  ]
  nextCurrent.weakness_summary = buildWeaknessSummary({
    legacyData,
    currentLesson,
    mistakeBuckets,
    currentState
  })
  nextCurrent.recent_focus = {
    grammar: unique([
      ...legacyPatterns,
      ...recentMistakeGrammar,
      ...(currentState.recent_focus?.grammar || [])
    ]).slice(0, 5),
    listening: unique([
      '第 ' + currentLesson + ' 课关键句听辨',
      ...(currentState.recent_focus?.listening || [])
    ]).slice(0, 3),
    speaking: unique([
      '第 ' + currentLesson + ' 课句型替换造句',
      ...(currentState.recent_focus?.speaking || [])
    ]).slice(0, 3)
  }
  nextCurrent.next_recommendation = {
    date: formatDateOnly(now),
    plan_type:
      legacyData.daily_plan?.plan_type === 'foundation_review' ? 'review_then_output' : 'targeted_rebuild',
    minutes:
      Number.isInteger(legacyData.daily_plan?.available_minutes) && legacyData.daily_plan.available_minutes > 0
        ? legacyData.daily_plan.available_minutes
        : currentState.next_recommendation.minutes
  }

  return validateCurrent(nextCurrent)
}

const mergeMasteryState = ({ legacyData, masteryState, now }) => {
  const lessonStats = legacyData.progress?.lesson_stats || {}
  const currentLesson = Number(legacyData.progress?.current_lesson) || 7
  const nextMastery = clone(masteryState)
  nextMastery.revision = masteryState.revision + 1
  nextMastery.updated_at = now
  nextMastery.current_gate = 'lesson-' + currentLesson + '-foundation'

  for (const stat of Object.values(lessonStats)) {
    const lesson = Number(stat.lesson_id)
    if (!Number.isInteger(lesson)) {
      continue
    }

    nextMastery.lesson_states[buildLessonStateKey(lesson)] = {
      lesson,
      status: deriveLessonStatus({
        rate: clampScore(stat.last_correct_rate || 0),
        questionCount: Number(stat.last_question_count) || 0
      }),
      skill_scores: deriveLessonSkillScores({
        rate: clampScore(stat.last_correct_rate || 0),
        lesson,
        currentLesson
      }),
      last_reviewed_at: stat.last_session_at || now
    }
  }

  for (const [pattern, patternState] of Object.entries(legacyData.pattern_mastery || {})) {
    const lesson = Number(patternState.lesson)
    if (!Number.isInteger(lesson)) {
      continue
    }

    const key = resolveGrammarPointKey({
      lesson,
      pattern,
      existingMastery: nextMastery
    })
    const recognition = clampScore(patternState.recognition || 0)
    const controlledOutput = clampScore(patternState.controlled_output || 0)
    const freeOutput = clampScore(patternState.free_output || 0)
    const maxScore = Math.max(recognition, controlledOutput, freeOutput)

    nextMastery.grammar_points[key] = {
      lesson,
      pattern,
      status: maxScore >= 0.7 ? 'stabilizing' : maxScore >= 0.35 ? 'learning' : 'weak',
      recognition,
      controlled_output: controlledOutput,
      free_output: freeOutput,
      last_practiced_at: patternState.last_practiced_at || now
    }
  }

  for (const bucket of buildLegacyMistakeBuckets(legacyData)) {
    if (/^q_/.test(bucket.grammar_point)) {
      continue
    }

    const key = resolveGrammarPointKey({
      lesson: bucket.lesson,
      pattern: bucket.grammar_point,
      existingMastery: nextMastery
    })
    const latest = bucket.latest || {}
    const recognitionBase = Math.max(0.15, 0.45 - bucket.count * 0.05)
    const controlledBase = Math.max(0.02, 0.2 - bucket.count * 0.03)

    nextMastery.grammar_points[key] = {
      lesson: bucket.lesson,
      pattern: bucket.grammar_point,
      status: 'weak',
      recognition: clampScore(recognitionBase),
      controlled_output: clampScore(controlledBase),
      free_output: clampScore(Math.max(0, controlledBase - 0.05)),
      last_practiced_at: latest.timestamp || now
    }
  }

  return validateMastery(nextMastery)
}

const buildQueueItemFromBucket = ({ bucket, dueDate, masteryState }) => {
  const grammarKey = /^q_/.test(bucket.grammar_point)
    ? 'lesson-' + bucket.lesson + '/' + slugifyText(bucket.grammar_point)
    : resolveGrammarPointKey({
        lesson: bucket.lesson,
        pattern: bucket.grammar_point,
        existingMastery: masteryState
      })

  return {
    id: 'rq-' + grammarKey.replace(/\//g, '-'),
    kind: /^q_/.test(bucket.grammar_point) ? 'legacy_mistake' : 'grammar_point',
    key: grammarKey,
  status: 'due',
  due_date: dueDate,
  interval_days: 1,
  ease: bucket.count >= 3 ? 1.7 : 1.9,
  last_result: 'wrong'
  }
}

const mergeReviewQueueState = ({ legacyData, reviewQueueState, now }) => {
  const nextReviewQueue = clone(reviewQueueState)
  nextReviewQueue.revision = reviewQueueState.revision + 1
  nextReviewQueue.updated_at = now
  const dueDate = formatDateOnly(now)
  const queueById = new Map(nextReviewQueue.items.map((item) => [item.id, item]))
  const queueByKey = new Map(nextReviewQueue.items.map((item) => [item.key, item]))

  for (const bucket of buildLegacyMistakeBuckets(legacyData)) {
    const queueItem = buildQueueItemFromBucket({
      bucket,
      dueDate,
      masteryState: { grammar_points: {} }
    })
    const existingItem = queueByKey.get(queueItem.key)
    if (existingItem) {
      existingItem.status = 'due'
      existingItem.due_date = dueDate
      existingItem.interval_days = 1
      existingItem.ease = Math.min(existingItem.ease, queueItem.ease)
      existingItem.last_result = 'wrong'
      continue
    }

    queueById.set(queueItem.id, queueItem)
    queueByKey.set(queueItem.key, queueItem)
  }

  for (const [pattern, patternState] of Object.entries(legacyData.pattern_mastery || {})) {
    const lesson = Number(patternState.lesson)
    if (!Number.isInteger(lesson)) {
      continue
    }

    const grammarKey = resolveGrammarPointKey({
      lesson,
      pattern,
      existingMastery: { grammar_points: {} }
    })
    const queueItem = {
      id: 'rq-' + grammarKey.replace(/\//g, '-'),
      kind: 'grammar_point',
      key: grammarKey,
      status: 'due',
      due_date: dueDate,
      interval_days: 1,
      ease: 2.0,
      last_result: 'wrong'
    }

    const existingItem = queueByKey.get(queueItem.key)
    if (existingItem) {
      existingItem.status = 'due'
      if (existingItem.last_result !== 'wrong') {
        existingItem.last_result = 'wrong'
      }
      existingItem.due_date = dueDate
      existingItem.interval_days = Math.min(existingItem.interval_days, 1)
      existingItem.ease = Math.min(existingItem.ease, queueItem.ease)
      continue
    }

    queueById.set(queueItem.id, queueItem)
    queueByKey.set(queueItem.key, queueItem)
  }

  nextReviewQueue.items = Array.from(queueById.values()).sort((left, right) => {
    const lessonLeft = Number(String(left.key).match(/lesson-(\d+)/)?.[1] || 999)
    const lessonRight = Number(String(right.key).match(/lesson-(\d+)/)?.[1] || 999)
    if (lessonLeft !== lessonRight) return lessonLeft - lessonRight
    return left.id.localeCompare(right.id)
  })

  return validateReviewQueue(nextReviewQueue)
}

const migrateLegacyDataToStudyState = ({
  legacyData,
  currentState,
  masteryState,
  reviewQueueState,
  now = () => new Date().toISOString()
}) => {
  const normalizedLegacyData = parseLegacyData(legacyData)
  const timestamp = now()
  const nextCurrent = mergeCurrentState({
    legacyData: normalizedLegacyData,
    currentState: validateCurrent(clone(currentState)),
    now: timestamp
  })
  const nextMastery = mergeMasteryState({
    legacyData: normalizedLegacyData,
    masteryState: validateMastery(clone(masteryState)),
    now: timestamp
  })
  const nextReviewQueue = mergeReviewQueueState({
    legacyData: normalizedLegacyData,
    reviewQueueState: validateReviewQueue(clone(reviewQueueState)),
    now: timestamp
  })
  const mistakeBuckets = buildLegacyMistakeBuckets(normalizedLegacyData)

  return {
    current: nextCurrent,
    mastery: nextMastery,
    reviewQueue: nextReviewQueue,
    report: {
      migrated_at: timestamp,
      source_updated_at: normalizedLegacyData.meta?.updated_at || null,
      current_lesson: normalizedLegacyData.progress?.current_lesson || null,
      migrated_lesson_state_count: Object.keys(normalizedLegacyData.progress?.lesson_stats || {}).length,
      migrated_pattern_count: Object.keys(normalizedLegacyData.pattern_mastery || {}).length,
      migrated_mistake_bucket_count: mistakeBuckets.length
    }
  }
}

export { buildLegacyMistakeBuckets, migrateLegacyDataToStudyState, parseLegacyData }
