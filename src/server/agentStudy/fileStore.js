import fs from 'fs'
import path from 'path'
import { validateDailyPacket, validateIndex, validateReviewResult } from '../../utils/agentStudySchema'
import { validateDailyPacketContentQuality } from '../../utils/agentStudyContentQuality'
import { loadAgentStudyIndexWithFallback } from './indexRebuilder'

const clone = (value) => JSON.parse(JSON.stringify(value))

const toPosixPath = (value) => value.split(path.sep).join('/')

const toStudyRelativePath = (studyRoot, absolutePath) => {
  const relativePath = path.relative(studyRoot, absolutePath)
  return toPosixPath(path.posix.join('study', toPosixPath(relativePath)))
}

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

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

const assertInsideStudyRoot = (studyRoot, candidatePath) => {
  const relativePath = path.relative(studyRoot, candidatePath)
  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('Resolved path must stay inside the study directory')
  }

  return candidatePath
}

const resolveStudyPath = (studyRoot, relativePath) => {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error('study path must be a non-empty string')
  }

  if (!relativePath.startsWith('study/')) {
    throw new Error('study path must start with "study/"')
  }

  const relativeWithinStudy = relativePath.slice('study/'.length)
  const absolutePath = path.resolve(studyRoot, relativeWithinStudy)
  return assertInsideStudyRoot(studyRoot, absolutePath)
}

const normalizeTimestamp = (timestampFactory) => timestampFactory()

const createAgentStudyFileStore = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString()
} = {}) => {
  const loadIndex = () =>
    loadAgentStudyIndexWithFallback({
      studyRoot,
      fsImpl,
      updatedAt: normalizeTimestamp(now)
    })

  const readStudyJson = (relativePath, validator) => {
    const absolutePath = resolveStudyPath(studyRoot, relativePath)
    return validator(readJsonFile(fsImpl, absolutePath))
  }

  const readStudyText = (relativePath) => {
    const absolutePath = resolveStudyPath(studyRoot, relativePath)
    return fsImpl.readFileSync(absolutePath, 'utf8')
  }

  const loadLatestDaily = () => {
    const indexDocument = loadIndex()
    if (!indexDocument.latest_daily) {
      return null
    }

    return readStudyJson(indexDocument.latest_daily, validateDailyPacket)
  }

  const loadLatestReview = () => {
    const indexDocument = loadIndex()
    if (!indexDocument.latest_review) {
      return null
    }

    return readStudyJson(indexDocument.latest_review, validateReviewResult)
  }

  const writeIndex = (indexDocument) => {
    const indexPath = path.join(studyRoot, 'index.json')
    atomicWriteText(fsImpl, indexPath, JSON.stringify(validateIndex(indexDocument), null, 2) + '\n')
  }

  const writeDailyPacket = ({ dailyPacket, targetPath, statusOverride = null }) => {
    const absolutePath = resolveStudyPath(studyRoot, targetPath)
    const existingDocument = fsImpl.existsSync(absolutePath) ? validateDailyPacket(readJsonFile(fsImpl, absolutePath)) : null

    const normalizedDaily = validateDailyPacket(clone(dailyPacket))
    validateDailyPacketContentQuality(normalizedDaily)

    if (existingDocument && normalizedDaily.revision !== existingDocument.revision) {
      throw new Error(
        'Revision conflict for ' +
          targetPath +
          ': expected ' +
          existingDocument.revision +
          ' but received ' +
          normalizedDaily.revision
      )
    }

    const timestamp = normalizeTimestamp(now)
    const nextDaily = {
      ...normalizedDaily,
      status: statusOverride || normalizedDaily.status,
      revision: existingDocument ? existingDocument.revision + 1 : normalizedDaily.revision,
      updated_at: timestamp
    }

    const validatedNextDaily = validateDailyPacket(nextDaily)
    validateDailyPacketContentQuality(validatedNextDaily)
    atomicWriteText(fsImpl, absolutePath, JSON.stringify(validatedNextDaily, null, 2) + '\n')

    const currentIndex = loadIndex()
    const nextIndex = {
      ...currentIndex,
      latest_daily: toStudyRelativePath(studyRoot, absolutePath),
      revision: currentIndex.revision + 1,
      updated_at: timestamp
    }
    writeIndex(nextIndex)

    return validatedNextDaily
  }

  const saveDailyDraft = ({ dailyPacket, targetPath }) =>
    writeDailyPacket({
      dailyPacket,
      targetPath
    })

  const submitDailyPacket = ({ dailyPacket, targetPath }) =>
    writeDailyPacket({
      dailyPacket,
      targetPath,
      statusOverride: 'submitted'
    })

  return {
    loadIndex,
    loadLatestDaily,
    loadLatestReview,
    readStudyJson,
    readStudyText,
    saveDailyDraft,
    submitDailyPacket
  }
}

export { createAgentStudyFileStore, resolveStudyPath }
