import fs from 'fs'
import path from 'path'
import {
  CURRENT_SCHEMA_VERSION,
  validateDailyPacket,
  validateMistakeBook,
  validateReviewResult
} from '../../utils/agentStudySchema.js'
import { resolveStudyPath } from './fileStore.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const MISTAKE_BOOK_PATH = 'study/state/mistakes.json'

const readJson = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

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

const toStudyPath = (studyRoot, absolutePath) =>
  'study/' + path.relative(studyRoot, absolutePath).split(path.sep).join('/')

const createEmptyMistakeBook = (timestamp) => ({
  schema_version: CURRENT_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  items: []
})

const createMistakeId = (reviewId, exerciseId) => `mistake:${reviewId}:${exerciseId}`

const createMistakeRecord = ({
  dailyPacket,
  dailyPath,
  reviewResult,
  reviewPath,
  reviewItem,
  existing = null
}) => {
  const exercise = dailyPacket.exercises.find((item) => item.id === reviewItem.exercise_id)
  if (!exercise) {
    throw new Error(
      'Mistake store could not find exercise ' +
        reviewItem.exercise_id +
        ' in daily packet ' +
        dailyPacket.id
    )
  }

  return {
    id: createMistakeId(reviewResult.id, reviewItem.exercise_id),
    status: existing?.status || 'active',
    created_at: existing?.created_at || reviewResult.created_at,
    source_daily: dailyPath,
    source_review: reviewPath,
    daily_id: dailyPacket.id,
    review_id: reviewResult.id,
    exercise_id: reviewItem.exercise_id,
    lesson: exercise.lesson,
    target_grammar: reviewItem.target_grammar,
    exercise_snapshot: clone(exercise),
    review_snapshot: clone(reviewItem),
    attempts: Array.isArray(existing?.attempts) ? clone(existing.attempts) : [],
    last_practiced_at: existing?.last_practiced_at || null
  }
}

const mergeReviewMistakes = ({
  mistakeBook,
  dailyPacket,
  dailyPath,
  reviewResult,
  reviewPath
}) => {
  const nextBook = clone(mistakeBook)
  const itemIndex = new Map(nextBook.items.map((item, index) => [item.id, index]))

  for (const reviewItem of reviewResult.items.filter((item) => !item.is_correct)) {
    const mistakeId = createMistakeId(reviewResult.id, reviewItem.exercise_id)
    const existingIndex = itemIndex.get(mistakeId)
    const existing = existingIndex == null ? null : nextBook.items[existingIndex]
    const record = createMistakeRecord({
      dailyPacket,
      dailyPath,
      reviewResult,
      reviewPath,
      reviewItem,
      existing
    })

    if (existingIndex == null) {
      itemIndex.set(mistakeId, nextBook.items.length)
      nextBook.items.push(record)
    } else {
      nextBook.items[existingIndex] = record
    }
  }

  nextBook.items.sort((left, right) => right.created_at.localeCompare(left.created_at))
  return nextBook
}

const createAgentStudyMistakeStore = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString()
} = {}) => {
  const mistakeBookAbsolutePath = resolveStudyPath(studyRoot, MISTAKE_BOOK_PATH)

  const writeMistakeBook = (mistakeBook) => {
    const validated = validateMistakeBook(mistakeBook)
    atomicWriteJson(fsImpl, mistakeBookAbsolutePath, validated)
    return validated
  }

  const rebuildFromHistory = () => {
    const timestamp = now()
    const existingBook = fsImpl.existsSync(mistakeBookAbsolutePath)
      ? validateMistakeBook(readJson(fsImpl, mistakeBookAbsolutePath))
      : null
    let mistakeBook = existingBook
      ? clone(existingBook)
      : createEmptyMistakeBook(timestamp)
    const dailyById = new Map()

    for (const dailyAbsolutePath of listJsonFiles(fsImpl, path.join(studyRoot, 'daily'))) {
      const dailyPacket = validateDailyPacket(readJson(fsImpl, dailyAbsolutePath))
      dailyById.set(dailyPacket.id, {
        dailyPacket,
        dailyPath: toStudyPath(studyRoot, dailyAbsolutePath)
      })
    }

    for (const reviewAbsolutePath of listJsonFiles(fsImpl, path.join(studyRoot, 'reviews'))) {
      const reviewResult = validateReviewResult(readJson(fsImpl, reviewAbsolutePath))
      const dailyEntry = dailyById.get(reviewResult.daily_id)
      if (!dailyEntry) continue

      mistakeBook = mergeReviewMistakes({
        mistakeBook,
        ...dailyEntry,
        reviewResult,
        reviewPath: toStudyPath(studyRoot, reviewAbsolutePath)
      })
    }

    if (
      existingBook &&
      JSON.stringify(mistakeBook.items) === JSON.stringify(existingBook.items)
    ) {
      return existingBook
    }

    if (existingBook) {
      mistakeBook.revision = existingBook.revision + 1
    }
    mistakeBook.updated_at = timestamp
    return writeMistakeBook(mistakeBook)
  }

  const loadMistakeBook = () => rebuildFromHistory()

  const syncFromReview = ({ dailyPacket, dailyPath, reviewResult, reviewPath }) => {
    const current = loadMistakeBook()
    const merged = mergeReviewMistakes({
      mistakeBook: current,
      dailyPacket: validateDailyPacket(clone(dailyPacket)),
      dailyPath,
      reviewResult: validateReviewResult(clone(reviewResult)),
      reviewPath
    })

    if (JSON.stringify(merged.items) === JSON.stringify(current.items)) {
      return current
    }

    merged.revision = current.revision + 1
    merged.updated_at = now()
    return writeMistakeBook(merged)
  }

  const recordAttempt = ({ mistakeId, answer }) => {
    const normalizedAnswer = String(answer || '').trim()
    if (!normalizedAnswer) {
      throw new Error('Mistake attempt requires a non-empty answer')
    }

    const current = loadMistakeBook()
    const itemIndex = current.items.findIndex((item) => item.id === mistakeId)
    if (itemIndex < 0) {
      throw new Error('Mistake not found: ' + mistakeId)
    }

    const timestamp = now()
    const nextBook = clone(current)
    const nextItem = nextBook.items[itemIndex]
    nextItem.attempts.push({
      id: `${mistakeId}:attempt:${nextItem.attempts.length + 1}`,
      submitted_at: timestamp,
      answer: normalizedAnswer
    })
    nextItem.last_practiced_at = timestamp
    nextBook.revision = current.revision + 1
    nextBook.updated_at = timestamp

    const mistakeBook = writeMistakeBook(nextBook)
    return {
      mistakeBook,
      mistake: mistakeBook.items.find((item) => item.id === mistakeId)
    }
  }

  return {
    loadMistakeBook,
    rebuildFromHistory,
    recordAttempt,
    syncFromReview
  }
}

export { MISTAKE_BOOK_PATH, createAgentStudyMistakeStore }
