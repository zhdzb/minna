import fs from 'fs'
import path from 'path'
import {
  CURRENT_SCHEMA_VERSION,
  validateReviewReadingState
} from '../../utils/agentStudySchema.js'
import { resolveStudyPath } from './fileStore.js'

const REVIEW_READING_PATH = 'study/state/review-reading.json'
const clone = (value) => JSON.parse(JSON.stringify(value))

const readJson = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const atomicWriteJson = (fsImpl, filePath, value) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8')
  try {
    fsImpl.unlinkSync(filePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  fsImpl.renameSync(tempPath, filePath)
}

const createEmptyState = (timestamp) => ({
  schema_version: CURRENT_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  reviews: {}
})

const createReviewReadingStore = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString()
} = {}) => {
  const absolutePath = resolveStudyPath(studyRoot, REVIEW_READING_PATH)

  const load = () => fsImpl.existsSync(absolutePath)
    ? validateReviewReadingState(readJson(fsImpl, absolutePath))
    : createEmptyState(now())

  const write = (state) => {
    const validated = validateReviewReadingState(state)
    atomicWriteJson(fsImpl, absolutePath, validated)
    return validated
  }

  const updateItem = ({ reviewId, reviewFile = null, exerciseId, status = null }) => {
    const normalizedReviewId = String(reviewId || '').trim()
    const normalizedExerciseId = String(exerciseId || '').trim()
    if (!normalizedReviewId) throw new Error('Review reading update requires reviewId')
    if (!normalizedExerciseId) throw new Error('Review reading update requires exerciseId')
    if (status != null && !['unread', 'read', 'later'].includes(status)) {
      throw new Error('Review reading status must be unread, read, or later')
    }

    const current = load()
    const timestamp = now()
    const next = clone(current)
    const review = next.reviews[normalizedReviewId] || {
      review_file: reviewFile,
      last_exercise_id: null,
      items: {},
      updated_at: timestamp
    }
    review.review_file = reviewFile || review.review_file || null
    review.last_exercise_id = normalizedExerciseId
    review.updated_at = timestamp
    if (status != null) {
      review.items[normalizedExerciseId] = {
        status,
        updated_at: timestamp
      }
    }
    next.reviews[normalizedReviewId] = review
    next.revision = current.revision + 1
    next.updated_at = timestamp

    return write(next)
  }

  return {
    load,
    updateItem
  }
}

export { REVIEW_READING_PATH, createReviewReadingStore }
