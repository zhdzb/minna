import fs from 'fs'
import path from 'path'
import {
  CURRENT_SCHEMA_VERSION,
  validateDailyPacket,
  validateReviewResult,
  validateVocabularyProgress
} from '../../utils/agentStudySchema.js'
import { resolveStudyPath } from './fileStore.js'
import { loadVocabularyCatalog } from './vocabularyCatalog.js'

const VOCABULARY_PROGRESS_PATH = 'study/state/vocabulary-progress.json'
const VOCABULARY_SELECTION_PATH = 'study/context/vocabulary-selection.json'

const clone = (value) => JSON.parse(JSON.stringify(value))
const readJson = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))
const toDateOnly = (value) => String(value || '').slice(0, 10)

const safeRemoveFile = (fsImpl, filePath) => {
  try {
    fsImpl.unlinkSync(filePath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error
  }
}

const atomicWriteJson = (fsImpl, filePath, value) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8')
  safeRemoveFile(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const listJsonFiles = (fsImpl, directoryPath) => {
  if (!fsImpl.existsSync(directoryPath)) return []
  return fsImpl
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort()
}

const addDays = (dateValue, days) => {
  const baseDate = toDateOnly(dateValue)
  const date = new Date(`${baseDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Vocabulary progress requires a valid evidence date')
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const createEmptyVocabularyProgress = (timestamp) => ({
  schema_version: CURRENT_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  processed_review_ids: [],
  items: {}
})

const createModeProgress = () => ({
  seen_count: 0,
  correct_count: 0
})

const createWordProgress = (timestamp) => ({
  status: 'learning',
  seen_count: 0,
  correct_count: 0,
  correct_streak: 0,
  last_result: 'unseen',
  last_seen_at: timestamp,
  due_date: toDateOnly(timestamp),
  modes: {
    production: createModeProgress(),
    reading: createModeProgress(),
    listening: createModeProgress()
  }
})

const resolveEvidenceMode = (exercise) => {
  const skill = String(exercise?.metadata?.skill || '').toLowerCase()
  const type = String(exercise?.type || '').toLowerCase()
  if (skill.includes('listen') || type === 'q_listening') return 'listening'
  if (skill.includes('read') || type === 'q_reading') return 'reading'
  return 'production'
}

const normalizeTerm = (value) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[\s。、，,.・]/g, '')
    .trim()

const buildCatalogIndex = (catalog) => {
  const byId = new Map()
  const byTerm = new Map()

  for (const item of catalog.items) {
    byId.set(item.id, item)
    for (const term of [item.word, item.kana]) {
      const key = normalizeTerm(term)
      if (!key) continue
      const values = byTerm.get(key) || []
      values.push(item.id)
      byTerm.set(key, values)
    }
  }

  return { byId, byTerm }
}

const applyWordEvidence = ({ existing, success, mode, timestamp }) => {
  const next = existing ? clone(existing) : createWordProgress(timestamp)
  next.seen_count += 1
  next.correct_count += success ? 1 : 0
  next.correct_streak = success ? next.correct_streak + 1 : 0
  next.last_result = success ? 'correct' : 'wrong'
  next.last_seen_at = timestamp
  next.modes[mode].seen_count += 1
  next.modes[mode].correct_count += success ? 1 : 0

  const practicedModes = Object.values(next.modes).filter((item) => item.correct_count > 0).length
  if (!success) {
    next.status = 'learning'
    next.due_date = addDays(timestamp, 1)
  } else if (next.correct_streak >= 3 && practicedModes >= 2) {
    next.status = 'mastered'
    next.due_date = addDays(timestamp, 21)
  } else if (next.correct_streak >= 2) {
    next.status = 'review'
    next.due_date = addDays(timestamp, practicedModes >= 2 ? 14 : 7)
  } else {
    next.status = 'learning'
    next.due_date = addDays(timestamp, 3)
  }

  return next
}

const applyReviewEvidence = ({ progress, dailyPacket, reviewResult, catalogIndex }) => {
  if (progress.processed_review_ids.includes(reviewResult.id)) {
    return { progress, changed: false }
  }

  const next = clone(progress)
  const exercisesById = new Map(dailyPacket.exercises.map((exercise) => [exercise.id, exercise]))
  let evidenceCount = 0

  for (const reviewItem of reviewResult.items) {
    const exercise = exercisesById.get(reviewItem.exercise_id)
    if (!exercise) continue
    const targetIds = Array.from(
      new Set(
        (exercise.metadata?.target_vocabulary_ids || []).filter((id) => catalogIndex.byId.has(id))
      )
    )
    if (targetIds.length === 0) continue

    const hasVocabularyError = reviewItem.error_tags.includes('vocabulary')
    const feedbackTerms = reviewItem.vocabulary_feedback.map((item) =>
      normalizeTerm(item.dictionary_form)
    )
    const failedTargetIds = new Set(
      feedbackTerms.flatMap((term) => catalogIndex.byTerm.get(term) || [])
    )
    const mode = resolveEvidenceMode(exercise)

    for (const targetId of targetIds) {
      const success =
        !hasVocabularyError ||
        (reviewItem.vocabulary_feedback.length > 0 && !failedTargetIds.has(targetId))
      next.items[targetId] = applyWordEvidence({
        existing: next.items[targetId],
        success,
        mode,
        timestamp: reviewResult.created_at
      })
      evidenceCount += 1
    }
  }

  next.processed_review_ids.push(reviewResult.id)
  return { progress: next, changed: true, evidenceCount }
}

const materializeVocabularyBook = ({ catalog, progress, date }) => {
  const today = toDateOnly(date)
  const items = catalog.items.map((item) => {
    const wordProgress = progress.items[item.id] || null
    return {
      ...item,
      status: wordProgress?.status || 'new',
      seen_count: wordProgress?.seen_count || 0,
      correct_count: wordProgress?.correct_count || 0,
      correct_streak: wordProgress?.correct_streak || 0,
      last_result: wordProgress?.last_result || 'unseen',
      last_seen_at: wordProgress?.last_seen_at || null,
      due_date: wordProgress?.due_date || null,
      is_due: Boolean(wordProgress?.due_date && wordProgress.due_date <= today),
      modes:
        wordProgress?.modes ||
        {
          production: createModeProgress(),
          reading: createModeProgress(),
          listening: createModeProgress()
        }
    }
  })

  const summary = {
    total: items.length,
    new: items.filter((item) => item.status === 'new').length,
    learning: items.filter((item) => item.status === 'learning').length,
    review: items.filter((item) => item.status === 'review').length,
    mastered: items.filter((item) => item.status === 'mastered').length,
    due: items.filter((item) => item.is_due).length,
    n5: items.filter((item) => item.estimated_level === 'N5').length,
    n4: items.filter((item) => item.estimated_level === 'N4').length
  }

  return { items, summary }
}

const compareDue = (left, right) => {
  if (left.last_result !== right.last_result) {
    return left.last_result === 'wrong' ? -1 : 1
  }
  const dateComparison = String(left.due_date || '').localeCompare(String(right.due_date || ''))
  return dateComparison || left.priority_rank - right.priority_rank
}

const selectVocabularyItems = ({ items, count }) => {
  const limit = Math.max(1, Math.min(24, Number(count) || 12))
  const selected = []
  const selectedIds = new Set()
  const addItems = (candidates, candidateLimit, reason) => {
    for (const item of candidates) {
      if (selected.length >= limit || candidateLimit <= 0) break
      if (selectedIds.has(item.id)) continue
      selectedIds.add(item.id)
      selected.push({ ...item, selection_reason: reason })
      candidateLimit -= 1
    }
  }

  const due = items.filter((item) => item.is_due).sort(compareDue)
  const fresh = items
    .filter((item) => item.status === 'new')
    .sort((left, right) => left.priority_rank - right.priority_rank)
  const learning = items
    .filter((item) => item.status === 'learning' && !item.is_due)
    .sort((left, right) => {
      if (left.last_result !== right.last_result) return left.last_result === 'wrong' ? -1 : 1
      return left.priority_rank - right.priority_rank
    })
  const retention = items
    .filter((item) => item.status === 'review' || item.status === 'mastered')
    .sort((left, right) => {
      const dateComparison = String(left.last_seen_at || '').localeCompare(
        String(right.last_seen_at || '')
      )
      return dateComparison || left.priority_rank - right.priority_rank
    })

  addItems(due, Math.ceil(limit * 0.3), 'due')
  addItems(fresh, Math.ceil(limit * 0.55), 'new')
  addItems([...due, ...fresh, ...learning, ...retention], limit - selected.length, 'rotation')

  return selected
}

const createAgentStudyVocabularyStore = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  catalog = loadVocabularyCatalog()
} = {}) => {
  const progressAbsolutePath = resolveStudyPath(studyRoot, VOCABULARY_PROGRESS_PATH)
  const selectionAbsolutePath = resolveStudyPath(studyRoot, VOCABULARY_SELECTION_PATH)
  const catalogIndex = buildCatalogIndex(catalog)

  const writeProgress = (progress) => {
    const validated = validateVocabularyProgress(progress)
    atomicWriteJson(fsImpl, progressAbsolutePath, validated)
    return validated
  }

  const loadStoredProgress = () => {
    if (!fsImpl.existsSync(progressAbsolutePath)) {
      return writeProgress(createEmptyVocabularyProgress(now()))
    }
    return validateVocabularyProgress(readJson(fsImpl, progressAbsolutePath))
  }

  const rebuildFromHistory = () => {
    const existing = loadStoredProgress()
    let next = clone(existing)
    let changed = false
    const dailyById = new Map()

    for (const dailyPath of listJsonFiles(fsImpl, path.join(studyRoot, 'daily'))) {
      const dailyPacket = validateDailyPacket(readJson(fsImpl, dailyPath))
      dailyById.set(dailyPacket.id, dailyPacket)
    }

    for (const reviewPath of listJsonFiles(fsImpl, path.join(studyRoot, 'reviews'))) {
      const reviewResult = validateReviewResult(readJson(fsImpl, reviewPath))
      if (next.processed_review_ids.includes(reviewResult.id)) continue
      const dailyPacket = dailyById.get(reviewResult.daily_id)
      if (!dailyPacket) continue
      const result = applyReviewEvidence({
        progress: next,
        dailyPacket,
        reviewResult,
        catalogIndex
      })
      next = result.progress
      changed = changed || result.changed
    }

    if (!changed) return existing
    next.revision = existing.revision + 1
    next.updated_at = now()
    return writeProgress(next)
  }

  const loadVocabularyBook = ({ date = now() } = {}) => {
    const progress = rebuildFromHistory()
    const materialized = materializeVocabularyBook({ catalog, progress, date })
    return {
      catalog: {
        version: catalog.version,
        updated_at: catalog.updated_at,
        ranking: catalog.ranking
      },
      progress,
      ...materialized
    }
  }

  const selectForPacket = ({ lesson, date = now(), count = 12, writeSnapshot = true } = {}) => {
    const book = loadVocabularyBook({ date })
    const items = selectVocabularyItems({ items: book.items, count })
    const snapshot = {
      schema_version: CURRENT_SCHEMA_VERSION,
      generated_at: now(),
      date: toDateOnly(date),
      lesson: Number(lesson || 1),
      count: items.length,
      summary: book.summary,
      items: items.map((item) => ({
        id: item.id,
        priority_rank: item.priority_rank,
        word: item.word,
        kana: item.kana,
        meaning: item.meaning,
        part_of_speech: item.part_of_speech,
        estimated_level: item.estimated_level,
        category: item.category,
        usage: item.usage,
        status: item.status,
        selection_reason: item.selection_reason
      }))
    }

    if (writeSnapshot) atomicWriteJson(fsImpl, selectionAbsolutePath, snapshot)
    return snapshot
  }

  const syncFromReview = ({ dailyPacket, reviewResult }) => {
    const current = rebuildFromHistory()
    if (current.processed_review_ids.includes(reviewResult.id)) return current
    const result = applyReviewEvidence({
      progress: current,
      dailyPacket: validateDailyPacket(clone(dailyPacket)),
      reviewResult: validateReviewResult(clone(reviewResult)),
      catalogIndex
    })
    if (!result.changed) return current

    result.progress.revision = current.revision + 1
    result.progress.updated_at = now()
    return writeProgress(result.progress)
  }

  return {
    loadVocabularyBook,
    rebuildFromHistory,
    selectForPacket,
    syncFromReview
  }
}

export {
  VOCABULARY_PROGRESS_PATH,
  VOCABULARY_SELECTION_PATH,
  createAgentStudyVocabularyStore,
  selectVocabularyItems
}
