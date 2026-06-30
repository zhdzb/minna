import fs from 'fs'
import path from 'path'
import {
  validateDailyPacket,
  validateIndex,
  validateReviewDrill,
  validateReviewResult
} from '../../utils/agentStudySchema'
import {
  validateDailyPacketContentQuality,
  validateReviewDrillContentQuality
} from '../../utils/agentStudyContentQuality'
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

const loadLatestValidatedDocumentFromDirectory = ({
  studyRoot,
  fsImpl,
  directoryPath,
  validator
}) => {
  const absoluteDirectory = resolveStudyPath(studyRoot, directoryPath)
  if (!fsImpl.existsSync(absoluteDirectory)) {
    return null
  }

  const candidateNames = fsImpl
    .readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .reverse()

  for (const fileName of candidateNames) {
    const absolutePath = path.join(absoluteDirectory, fileName)
    const document = validator(readJsonFile(fsImpl, absolutePath))
    return document
  }

  return null
}

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

  const loadLatestReviewDrill = () =>
    loadLatestValidatedDocumentFromDirectory({
      studyRoot,
      fsImpl,
      directoryPath: 'study/review-drills',
      validator: validateReviewDrill
    })

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

  const writeReviewDrill = ({ reviewDrill, targetPath, statusOverride = null }) => {
    const absolutePath = resolveStudyPath(studyRoot, targetPath)
    const existingDocument = fsImpl.existsSync(absolutePath)
      ? validateReviewDrill(readJsonFile(fsImpl, absolutePath))
      : null

    const normalizedReviewDrill = validateReviewDrill(clone(reviewDrill))
    validateReviewDrillContentQuality(normalizedReviewDrill)

    if (existingDocument && normalizedReviewDrill.revision !== existingDocument.revision) {
      throw new Error(
        'Revision conflict for ' +
          targetPath +
          ': expected ' +
          existingDocument.revision +
          ' but received ' +
          normalizedReviewDrill.revision
      )
    }

    const timestamp = normalizeTimestamp(now)
    const nextReviewDrill = {
      ...normalizedReviewDrill,
      status: statusOverride || normalizedReviewDrill.status,
      revision: existingDocument ? existingDocument.revision + 1 : normalizedReviewDrill.revision,
      updated_at: timestamp,
      submission: {
        ...normalizedReviewDrill.submission,
        submitted_at:
          statusOverride === 'submitted'
            ? timestamp
            : normalizedReviewDrill.submission.submitted_at
      },
      items: normalizedReviewDrill.items.map((item) => ({
        ...item,
        status: statusOverride === 'submitted' ? 'submitted' : item.status
      }))
    }

    const validatedNextReviewDrill = validateReviewDrill(nextReviewDrill)
    validateReviewDrillContentQuality(validatedNextReviewDrill)
    atomicWriteText(fsImpl, absolutePath, JSON.stringify(validatedNextReviewDrill, null, 2) + '\n')

    return validatedNextReviewDrill
  }

  const saveReviewDrillDraft = ({ reviewDrill, targetPath }) =>
    writeReviewDrill({
      reviewDrill,
      targetPath
    })

  const submitReviewDrill = ({ reviewDrill, targetPath }) =>
    writeReviewDrill({
      reviewDrill,
      targetPath,
      statusOverride: 'submitted'
    })

  return {
    loadIndex,
    loadLatestDaily,
    loadLatestReviewDrill,
    loadLatestReview,
    readStudyJson,
    readStudyText,
    saveDailyDraft,
    saveReviewDrillDraft,
    submitDailyPacket,
    submitReviewDrill
  }
}

export { createAgentStudyFileStore, resolveStudyPath }
