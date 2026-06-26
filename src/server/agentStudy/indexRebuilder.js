import fs from 'fs'
import path from 'path'
import { CURRENT_SCHEMA_VERSION, validateDailyPacket, validateIndex, validateReviewResult } from '../../utils/agentStudySchema'

const DEFAULT_SCHEMA_VERSIONS = Object.freeze({
  index: CURRENT_SCHEMA_VERSION,
  profile: CURRENT_SCHEMA_VERSION,
  current: CURRENT_SCHEMA_VERSION,
  mastery: CURRENT_SCHEMA_VERSION,
  review_queue: CURRENT_SCHEMA_VERSION,
  promotion_rules: CURRENT_SCHEMA_VERSION,
  daily_packet: CURRENT_SCHEMA_VERSION,
  review_result: CURRENT_SCHEMA_VERSION
})

const toPosixPath = (value) => value.split(path.sep).join('/')

const toStudyRelativePath = (studyRoot, absolutePath) => {
  const relativePath = path.relative(studyRoot, absolutePath)
  return toPosixPath(path.posix.join('study', toPosixPath(relativePath)))
}

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const listFiles = (fsImpl, directoryPath, extension) => {
  if (!fsImpl.existsSync(directoryPath)) {
    return []
  }

  return fsImpl
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === extension)
    .map((entry) => path.join(directoryPath, entry.name))
}

const pickLatestValidDocument = ({ studyRoot, directoryName, extension, fsImpl, validator }) => {
  const directoryPath = path.join(studyRoot, directoryName)
  const candidates = listFiles(fsImpl, directoryPath, extension).sort((left, right) => right.localeCompare(left))

  for (const candidatePath of candidates) {
    try {
      validator(readJsonFile(fsImpl, candidatePath))
      return toStudyRelativePath(studyRoot, candidatePath)
    } catch {
      // Ignore invalid candidates and continue scanning for the latest valid file.
    }
  }

  return null
}

const pickLatestPrompt = ({ studyRoot, fsImpl }) => {
  const promptDirectory = path.join(studyRoot, 'prompts', 'generated')
  const candidates = listFiles(fsImpl, promptDirectory, '.md').sort((left, right) => right.localeCompare(left))

  return candidates.length > 0 ? toStudyRelativePath(studyRoot, candidates[0]) : null
}

const buildRebuiltIndex = ({
  studyRoot,
  fsImpl = fs,
  revision = 1,
  updatedAt = new Date().toISOString(),
  schemaVersions = DEFAULT_SCHEMA_VERSIONS
}) => {
  const indexDocument = {
    schema_version: CURRENT_SCHEMA_VERSION,
    revision,
    updated_at: updatedAt,
    latest_daily: pickLatestValidDocument({
      studyRoot,
      directoryName: 'daily',
      extension: '.json',
      fsImpl,
      validator: validateDailyPacket
    }),
    latest_prompt: pickLatestPrompt({ studyRoot, fsImpl }),
    latest_review: pickLatestValidDocument({
      studyRoot,
      directoryName: 'reviews',
      extension: '.json',
      fsImpl,
      validator: validateReviewResult
    }),
    schema_versions: {
      ...DEFAULT_SCHEMA_VERSIONS,
      ...schemaVersions
    }
  }

  return validateIndex(indexDocument)
}

const rebuildAgentStudyIndex = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  revision = 1,
  updatedAt = new Date().toISOString(),
  schemaVersions = DEFAULT_SCHEMA_VERSIONS,
  write = true
} = {}) => {
  const nextIndex = buildRebuiltIndex({
    studyRoot,
    fsImpl,
    revision,
    updatedAt,
    schemaVersions
  })

  if (write) {
    const indexPath = path.join(studyRoot, 'index.json')
    fsImpl.mkdirSync(path.dirname(indexPath), { recursive: true })
    fsImpl.writeFileSync(indexPath, JSON.stringify(nextIndex, null, 2) + '\n', 'utf8')
  }

  return nextIndex
}

const loadAgentStudyIndexWithFallback = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  updatedAt = new Date().toISOString()
} = {}) => {
  const indexPath = path.join(studyRoot, 'index.json')

  try {
    return validateIndex(readJsonFile(fsImpl, indexPath))
  } catch {
    return rebuildAgentStudyIndex({
      studyRoot,
      fsImpl,
      updatedAt,
      write: true
    })
  }
}

export {
  DEFAULT_SCHEMA_VERSIONS,
  buildRebuiltIndex,
  loadAgentStudyIndexWithFallback,
  rebuildAgentStudyIndex
}
