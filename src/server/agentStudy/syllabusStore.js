import fs from 'fs'
import path from 'path'

const clone = (value) => JSON.parse(JSON.stringify(value))

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

const normalizeString = (value, label) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    throw new Error(`${label} 不能为空`)
  }
  return normalized
}

const normalizeStringArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必须是数组`)
  }

  return value
    .map((item, index) => normalizeString(item, `${label}[${index}]`))
}

const normalizeQuestionType = (item, index) => {
  if (!item || typeof item !== 'object') {
    throw new Error(`question_types[${index}] 必须是对象`)
  }

  return {
    id: normalizeString(item.id, `question_types[${index}].id`),
    name: normalizeString(item.name, `question_types[${index}].name`),
    desc: normalizeString(item.desc, `question_types[${index}].desc`),
    difficulty_range: Array.isArray(item.difficulty_range) && item.difficulty_range.length === 2
      ? item.difficulty_range.map((value, rangeIndex) => {
          const normalized = Number(value)
          if (!Number.isFinite(normalized)) {
            throw new Error(`question_types[${index}].difficulty_range[${rangeIndex}] 必须是数字`)
          }
          return normalized
        })
      : [1, 3]
  }
}

const normalizeVocabularyItem = (item, index, lessonIndex) => {
  if (!item || typeof item !== 'object') {
    throw new Error(`lessons[${lessonIndex}].core_vocabulary[${index}] 必须是对象`)
  }

  return {
    word: normalizeString(item.word, `lessons[${lessonIndex}].core_vocabulary[${index}].word`),
    kana: String(item.kana || '').trim(),
    meaning: String(item.meaning || '').trim(),
    usage: String(item.usage || '').trim()
  }
}

const normalizeLesson = (item, index, questionTypeIds) => {
  if (!item || typeof item !== 'object') {
    throw new Error(`lessons[${index}] 必须是对象`)
  }

  const lessonId = Number(item.id)
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    throw new Error(`lessons[${index}].id 必须是正整数`)
  }

  const enabledQuestionTypes = Array.isArray(item.enabled_question_types)
    ? item.enabled_question_types
        .map((typeId, typeIndex) =>
          normalizeString(typeId, `lessons[${index}].enabled_question_types[${typeIndex}]`)
        )
        .filter((typeId) => questionTypeIds.has(typeId))
    : []

  return {
    id: lessonId,
    title: normalizeString(item.title, `lessons[${index}].title`),
    theme: normalizeString(item.theme, `lessons[${index}].theme`),
    grammar_points: normalizeStringArray(item.grammar_points, `lessons[${index}].grammar_points`),
    sentence_patterns: normalizeStringArray(item.sentence_patterns, `lessons[${index}].sentence_patterns`),
    hidden_knowledge: normalizeStringArray(item.hidden_knowledge, `lessons[${index}].hidden_knowledge`),
    core_vocabulary: Array.isArray(item.core_vocabulary)
      ? item.core_vocabulary.map((entry, entryIndex) => normalizeVocabularyItem(entry, entryIndex, index))
      : [],
    enabled_question_types: enabledQuestionTypes.length ? enabledQuestionTypes : Array.from(questionTypeIds)
  }
}

const validateSyllabusDocument = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('syllabus 必须是对象')
  }

  const questionTypes = Array.isArray(value.question_types)
    ? value.question_types.map(normalizeQuestionType)
    : []

  if (!questionTypes.length) {
    throw new Error('至少需要一个题型定义')
  }

  const questionTypeIds = new Set(questionTypes.map((item) => item.id))
  const lessons = Array.isArray(value.lessons)
    ? value.lessons.map((item, index) => normalizeLesson(item, index, questionTypeIds))
    : []

  if (!lessons.length) {
    throw new Error('至少需要一课知识点')
  }

  return {
    question_types: questionTypes,
    lessons
  }
}

const createSyllabusStore = ({
  fsImpl = fs,
  syllabusPath = path.resolve(process.cwd(), 'src', 'data', 'syllabus.json')
} = {}) => {
  const loadSyllabus = () =>
    validateSyllabusDocument(JSON.parse(fsImpl.readFileSync(syllabusPath, 'utf8')))

  const saveSyllabus = (value) => {
    const normalized = validateSyllabusDocument(clone(value))
    atomicWriteText(fsImpl, syllabusPath, JSON.stringify(normalized, null, 2) + '\n')
    return normalized
  }

  return {
    loadSyllabus,
    saveSyllabus
  }
}

export { createSyllabusStore, validateSyllabusDocument }
