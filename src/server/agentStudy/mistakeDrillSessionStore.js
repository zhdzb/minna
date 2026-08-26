import fs from 'fs'
import path from 'path'
import {
  CURRENT_SCHEMA_VERSION,
  validateMistakeBook,
  validateMistakeDrillSession
} from '../../utils/agentStudySchema.js'
import { resolveStudyPath } from './fileStore.js'

const MISTAKE_DRILL_SESSION_PATH = 'study/state/mistake-drill-session.json'
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

const createIdleSession = (timestamp) => ({
  schema_version: CURRENT_SCHEMA_VERSION,
  revision: 1,
  updated_at: timestamp,
  status: 'idle',
  size: 3,
  mistake_ids: [],
  current_index: 0,
  submitted_ids: [],
  started_at: null,
  completed_at: null
})

const compareMistakes = (left, right) => {
  const leftPracticed = left.last_practiced_at || ''
  const rightPracticed = right.last_practiced_at || ''
  if (leftPracticed !== rightPracticed) return leftPracticed.localeCompare(rightPracticed)
  if (left.attempts.length !== right.attempts.length) return right.attempts.length - left.attempts.length
  return left.created_at.localeCompare(right.created_at)
}

const createMistakeDrillSessionStore = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString()
} = {}) => {
  const absolutePath = resolveStudyPath(studyRoot, MISTAKE_DRILL_SESSION_PATH)

  const load = () => fsImpl.existsSync(absolutePath)
    ? validateMistakeDrillSession(readJson(fsImpl, absolutePath))
    : createIdleSession(now())

  const write = (session) => {
    const validated = validateMistakeDrillSession(session)
    atomicWriteJson(fsImpl, absolutePath, validated)
    return validated
  }

  const start = ({ mistakeBook, size = 3, mistakeIds = [] }) => {
    const normalizedBook = validateMistakeBook(clone(mistakeBook))
    const normalizedSize = Number(size)
    if (![3, 5, 10].includes(normalizedSize)) {
      throw new Error('Mistake drill size must be 3, 5, or 10')
    }
    const requestedIds = new Set((mistakeIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    const candidates = normalizedBook.items
      .filter((item) => item.status === 'active' && (!requestedIds.size || requestedIds.has(item.id)))
      .sort(compareMistakes)
      .slice(0, normalizedSize)
    if (!candidates.length) throw new Error('No active mistakes are available for training')

    const current = load()
    const timestamp = now()
    return write({
      schema_version: CURRENT_SCHEMA_VERSION,
      revision: current.revision + 1,
      updated_at: timestamp,
      status: 'active',
      size: normalizedSize,
      mistake_ids: candidates.map((item) => item.id),
      current_index: 0,
      submitted_ids: [],
      started_at: timestamp,
      completed_at: null
    })
  }

  const advance = ({ mistakeId }) => {
    const current = load()
    if (current.status !== 'active') throw new Error('No active mistake drill session')
    const expectedId = current.mistake_ids[current.current_index]
    if (expectedId !== mistakeId) throw new Error('Mistake drill progress does not match the current item')

    const timestamp = now()
    const next = clone(current)
    next.submitted_ids = [...new Set([...next.submitted_ids, mistakeId])]
    next.current_index += 1
    if (next.current_index >= next.mistake_ids.length) {
      next.status = 'completed'
      next.completed_at = timestamp
    }
    next.revision = current.revision + 1
    next.updated_at = timestamp
    return write(next)
  }

  const end = () => {
    const current = load()
    const timestamp = now()
    const next = clone(current)
    next.status = 'completed'
    next.completed_at = timestamp
    next.revision = current.revision + 1
    next.updated_at = timestamp
    return write(next)
  }

  return { advance, end, load, start }
}

export { MISTAKE_DRILL_SESSION_PATH, createMistakeDrillSessionStore }
