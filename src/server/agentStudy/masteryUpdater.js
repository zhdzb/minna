import { validateMastery, validateReviewResult } from '../../utils/agentStudySchema'

const clone = (value) => JSON.parse(JSON.stringify(value))

const STATUS_ORDER = ['new', 'learning', 'weak', 'stabilizing', 'mastered', 'decayed']

const GRAMMAR_RUBRIC_KEYS = ['grammar', 'target_grammar', 'pattern_match', 'particles', 'target_particle']
const SPEAKING_RUBRIC_KEYS = ['naturalness', 'politeness', 'context_match', 'intent']
const LISTENING_RUBRIC_KEYS = ['listening', 'listening_accuracy', 'keyword_hit_rate', 'keywords', 'listening_keywords']
const READING_RUBRIC_KEYS = ['reading', 'reading_comprehension', 'comprehension']

const clampScore = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Mastery updater expected numeric review scores')
  }

  if (value < 0 || value > 1) {
    throw new Error('Mastery updater expected scores inside the 0..1 range')
  }

  return value
}

const normalizePattern = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const parseLessonFromKey = (value) => {
  const match = String(value || '').match(/lesson-(\d+)/i)
  return match ? Number(match[1]) : null
}

const average = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const blendScore = (currentValue, nextValue, confidenceWeight) => {
  const current = clampScore(currentValue)
  const target = clampScore(nextValue)
  const weight = Math.min(0.8, Math.max(0.25, confidenceWeight))
  return Number((current * (1 - weight) + target * weight).toFixed(4))
}

const averageRubricKeys = (rubric, keys, fallback) => {
  if (!rubric || typeof rubric !== 'object') {
    return fallback
  }

  const values = keys
    .filter((key) => Object.prototype.hasOwnProperty.call(rubric, key))
    .map((key) => clampScore(rubric[key]))

  return values.length > 0 ? average(values) : fallback
}

const buildReviewItemIndex = (reviewResult) => {
  const byExerciseId = new Map()
  for (const item of reviewResult.items) {
    byExerciseId.set(item.exercise_id, item)
  }
  return byExerciseId
}

const findEvidenceItems = (update, reviewItemIndex) => {
  const evidenceStrings = Array.isArray(update.evidence) ? update.evidence : []
  const matched = []

  for (const evidence of evidenceStrings) {
    const text = String(evidence || '')
    for (const [exerciseId, item] of reviewItemIndex.entries()) {
      if (text.includes(exerciseId) && !matched.includes(item)) {
        matched.push(item)
      }
    }
  }

  return matched
}

const resolveGrammarPointKey = ({ mastery, update, evidenceItems }) => {
  if (mastery.grammar_points[update.key]) {
    return update.key
  }

  const lesson = parseLessonFromKey(update.key)
  const targetPatterns = evidenceItems.map((item) => normalizePattern(item.target_grammar)).filter(Boolean)

  const candidates = Object.entries(mastery.grammar_points)
    .filter(([, point]) => lesson == null || point.lesson === lesson)
    .filter(([, point]) => {
      if (targetPatterns.length === 0) return false
      return targetPatterns.includes(normalizePattern(point.pattern))
    })

  if (candidates.length === 1) {
    return candidates[0][0]
  }

  throw new Error('Unable to resolve mastery grammar point for review update key: ' + update.key)
}

const validateStatus = (status, label) => {
  if (!STATUS_ORDER.includes(status)) {
    throw new Error(label + ' must be one of: ' + STATUS_ORDER.join(', '))
  }
  return status
}

const normalizeMasteryUpdate = (update, index) => {
  if (!update || typeof update !== 'object' || Array.isArray(update)) {
    throw new Error('reviewResult.mastery_updates[' + index + '] must be an object')
  }

  if (typeof update.scope !== 'string' || update.scope.trim() === '') {
    throw new Error('reviewResult.mastery_updates[' + index + '].scope must be a non-empty string')
  }

  if (update.scope !== 'grammar_point') {
    throw new Error('Unsupported mastery update scope: ' + update.scope)
  }

  if (typeof update.key !== 'string' || update.key.trim() === '') {
    throw new Error('reviewResult.mastery_updates[' + index + '].key must be a non-empty string')
  }

  if (!Array.isArray(update.evidence) || update.evidence.length === 0) {
    throw new Error('reviewResult.mastery_updates[' + index + '].evidence must contain review evidence')
  }

  return {
    scope: update.scope,
    key: update.key.trim(),
    from_status: update.from_status == null ? null : validateStatus(update.from_status, 'reviewResult.mastery_updates[' + index + '].from_status'),
    to_status: validateStatus(update.to_status, 'reviewResult.mastery_updates[' + index + '].to_status'),
    evidence: update.evidence.map((item) => String(item || '').trim()).filter(Boolean)
  }
}

const collectSkillEvidence = (reviewItems) => {
  const evidenceBySkill = {
    grammar: [],
    listening: [],
    speaking: [],
    reading: []
  }

  for (const item of reviewItems) {
    const confidence = item.confidence == null ? 1 : clampScore(item.confidence)
    const fallback = clampScore(item.score)
    const weightedFallback = clampScore(Number((fallback * confidence).toFixed(4)))

    const grammarScore = averageRubricKeys(item.rubric, GRAMMAR_RUBRIC_KEYS, weightedFallback)
    const speakingScore = averageRubricKeys(item.rubric, SPEAKING_RUBRIC_KEYS, null)
    const listeningScore = averageRubricKeys(item.rubric, LISTENING_RUBRIC_KEYS, null)
    const readingScore = averageRubricKeys(item.rubric, READING_RUBRIC_KEYS, null)

    evidenceBySkill.grammar.push(clampScore(Number((grammarScore * confidence).toFixed(4))))
    if (speakingScore != null) evidenceBySkill.speaking.push(clampScore(Number((speakingScore * confidence).toFixed(4))))
    if (listeningScore != null) evidenceBySkill.listening.push(clampScore(Number((listeningScore * confidence).toFixed(4))))
    if (readingScore != null) evidenceBySkill.reading.push(clampScore(Number((readingScore * confidence).toFixed(4))))
  }

  return evidenceBySkill
}

const deriveLessonStatus = ({ lessonPoints, skillScores, canAdvance, hasEvidence }) => {
  if (!hasEvidence) {
    return null
  }

  if (lessonPoints.some((point) => point.status === 'weak' || point.status === 'decayed')) {
    return 'weak'
  }

  const averageScore = average(Object.values(skillScores))
  if (averageScore == null) {
    return 'learning'
  }

  if (canAdvance && averageScore >= 0.8) {
    return 'mastered'
  }

  if (averageScore >= 0.65) {
    return 'stabilizing'
  }

  if (averageScore >= 0.45) {
    return 'learning'
  }

  return 'weak'
}

const updateMasteryFromReview = ({
  mastery,
  reviewResult,
  now = () => new Date().toISOString()
}) => {
  const normalizedMastery = validateMastery(clone(mastery))
  const normalizedReviewResult = validateReviewResult(clone(reviewResult))
  const timestamp = now()
  const reviewItemIndex = buildReviewItemIndex(normalizedReviewResult)

  const nextMastery = clone(normalizedMastery)
  const affectedLessons = new Map()
  let didChange = false

  normalizedReviewResult.mastery_updates
    .map(normalizeMasteryUpdate)
    .forEach((update) => {
      const evidenceItems = findEvidenceItems(update, reviewItemIndex)
      if (evidenceItems.length === 0) {
        throw new Error('Mastery update ' + update.key + ' has no matching review item evidence')
      }

      const resolvedKey = resolveGrammarPointKey({
        mastery: nextMastery,
        update,
        evidenceItems
      })

      const point = nextMastery.grammar_points[resolvedKey]
      if (!point) {
        throw new Error('Mastery grammar point not found: ' + resolvedKey)
      }

      if (update.from_status && point.status !== update.from_status) {
        throw new Error(
          'Mastery update ' +
            resolvedKey +
            ' expected status ' +
            update.from_status +
            ' but found ' +
            point.status
        )
      }

      const confidenceAverage = average(
        evidenceItems.map((item) => (item.confidence == null ? 1 : clampScore(item.confidence)))
      )
      const weight = 0.25 + confidenceAverage * 0.45

      const recognitionEvidence = average(
        evidenceItems.map((item) =>
          averageRubricKeys(item.rubric, ['meaning', 'recognition', 'comprehension'], clampScore(item.score))
        )
      )
      const controlledOutputEvidence = average(
        evidenceItems.map((item) =>
          averageRubricKeys(item.rubric, GRAMMAR_RUBRIC_KEYS, clampScore(item.score))
        )
      )
      const freeOutputEvidence = average(
        evidenceItems.map((item) =>
          averageRubricKeys(item.rubric, SPEAKING_RUBRIC_KEYS, clampScore(item.score))
        )
      )

      point.status = update.to_status
      point.recognition = blendScore(point.recognition, recognitionEvidence ?? point.recognition, weight)
      point.controlled_output = blendScore(
        point.controlled_output,
        controlledOutputEvidence ?? point.controlled_output,
        weight
      )
      point.free_output = blendScore(point.free_output, freeOutputEvidence ?? point.free_output, weight)
      point.last_practiced_at = normalizedReviewResult.created_at

      affectedLessons.set(point.lesson, [
        ...(affectedLessons.get(point.lesson) || []),
        ...evidenceItems
      ])
      didChange = true
    })

  for (const [lesson, reviewItems] of affectedLessons.entries()) {
    const lessonKey = Object.keys(nextMastery.lesson_states).find(
      (key) => nextMastery.lesson_states[key]?.lesson === lesson
    )
    if (!lessonKey) {
      throw new Error('Mastery lesson state not found for lesson ' + lesson)
    }

    const lessonState = nextMastery.lesson_states[lessonKey]
    const evidenceBySkill = collectSkillEvidence(reviewItems)

    for (const skill of Object.keys(lessonState.skill_scores)) {
      const skillEvidence = average(evidenceBySkill[skill])
      if (skillEvidence == null) {
        continue
      }

      lessonState.skill_scores[skill] = blendScore(
        lessonState.skill_scores[skill],
        skillEvidence,
        0.35
      )
    }

    const lessonPoints = Object.values(nextMastery.grammar_points).filter((point) => point.lesson === lesson)
    const nextStatus = deriveLessonStatus({
      lessonPoints,
      skillScores: lessonState.skill_scores,
      canAdvance: normalizedReviewResult.promotion_decision.can_advance,
      hasEvidence: reviewItems.length > 0
    })

    if (nextStatus) {
      lessonState.status = nextStatus
    }
    lessonState.last_reviewed_at = normalizedReviewResult.created_at
  }

  if (!didChange) {
    return normalizedMastery
  }

  nextMastery.revision = normalizedMastery.revision + 1
  nextMastery.updated_at = timestamp
  return validateMastery(nextMastery)
}

export { updateMasteryFromReview }
