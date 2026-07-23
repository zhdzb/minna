import {
  validateCurrent,
  validateMastery,
  validateMistakeBook,
  validateProfile,
  validateReviewQueue,
  validateVocabularyProgress
} from '../../utils/agentStudySchema.js'
import {
  LISTENING_LAB_SCHEMA_VERSION,
  validateListeningSourceSnapshot
} from '../../utils/listeningLabSchema.js'
import { createAgentStudyFileStore } from '../agentStudy/fileStore.js'
import { loadVocabularyCatalog } from '../agentStudy/vocabularyCatalog.js'

const unique = (items) =>
  Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))

const toDateOnly = (value) => String(value || '').slice(0, 10)

const summarizeMistakeTags = (mistakeBook) => {
  const counts = new Map()
  const ignoredTags = new Set([
    'kana_kanji',
    'name_spelling',
    'punctuation',
    'full_width_half_width'
  ])
  for (const item of (mistakeBook.items || []).filter((entry) => entry.status === 'active').slice(0, 40)) {
    for (const tag of item.review_snapshot?.error_tags || []) {
      if (ignoredTags.has(tag)) continue
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 8)
}

const pickGrammarFocus = ({ current, mastery }) => {
  const weakPatterns = Object.values(mastery.grammar_points || {})
    .filter((point) => Number(point.lesson) >= Number(current.current_lesson))
    .sort(
      (left, right) =>
        Number(left.recognition || 0) - Number(right.recognition || 0) ||
        Number(left.controlled_output || 0) - Number(right.controlled_output || 0)
    )
    .map((point) => point.pattern)

  return unique([
    ...(current.active_goals || []),
    ...(current.recent_focus?.grammar || []),
    ...weakPatterns
  ]).slice(0, 8)
}

const materializeVocabularyTargets = ({ catalog, progress, selection, date }) => {
  const selectedIds = new Set((selection?.items || []).map((item) => item.id))
  const today = toDateOnly(date)
  const items = catalog.items.map((item) => {
    const itemProgress = progress.items?.[item.id]
    return {
      id: item.id,
      word: item.word,
      kana: item.kana,
      meaning: item.meaning,
      status: itemProgress?.status || 'new',
      is_due: Boolean(itemProgress?.due_date && itemProgress.due_date <= today),
      selected: selectedIds.has(item.id),
      priority_rank: item.priority_rank
    }
  })

  return items
    .sort((left, right) => {
      const leftScore =
        (left.is_due ? 0 : 20) +
        (left.status === 'learning' ? 0 : left.status === 'review' ? 4 : 8) +
        (left.selected ? 0 : 12)
      const rightScore =
        (right.is_due ? 0 : 20) +
        (right.status === 'learning' ? 0 : right.status === 'review' ? 4 : 8) +
        (right.selected ? 0 : 12)
      return leftScore - rightScore || left.priority_rank - right.priority_rank
    })
    .slice(0, 12)
    .map(({ id, word, kana, meaning, status }) => ({
      id,
      word,
      kana,
      meaning,
      status
    }))
}

const buildListeningSourceSnapshot = ({
  fileStore = createAgentStudyFileStore(),
  catalog = loadVocabularyCatalog(),
  now = () => new Date().toISOString()
} = {}) => {
  const profile = fileStore.readStudyJson('study/state/profile.json', validateProfile)
  const current = fileStore.readStudyJson('study/state/current.json', validateCurrent)
  const mastery = fileStore.readStudyJson('study/state/mastery.json', validateMastery)
  const reviewQueue = fileStore.readStudyJson(
    'study/state/review-queue.json',
    validateReviewQueue
  )
  const mistakeBook = fileStore.readStudyJson(
    'study/state/mistakes.json',
    validateMistakeBook
  )
  const vocabularyProgress = fileStore.readStudyJson(
    'study/state/vocabulary-progress.json',
    validateVocabularyProgress
  )
  let vocabularySelection = null
  try {
    vocabularySelection = fileStore.readStudyJson(
      'study/context/vocabulary-selection.json',
      (value) => value
    )
  } catch (_error) {
    vocabularySelection = null
  }

  const timestamp = now()
  const focusLessons = unique([
    current.current_lesson,
    ...(profile.material_scope?.current_focus_lessons || [])
  ])
    .map(Number)
    .filter((lesson) => Number.isInteger(lesson) && lesson > 0)
    .slice(0, 5)

  return validateListeningSourceSnapshot({
    schema_version: LISTENING_LAB_SCHEMA_VERSION,
    revision: 1,
    updated_at: timestamp,
    id: 'listening-source-' + timestamp.replace(/[^0-9]/g, '').slice(0, 14),
    generated_at: timestamp,
    source_revisions: {
      profile: profile.revision,
      current: current.revision,
      mastery: mastery.revision,
      review_queue: reviewQueue.revision,
      mistakes: mistakeBook.revision,
      vocabulary_progress: vocabularyProgress.revision
    },
    current_lesson: current.current_lesson,
    focus_lessons: focusLessons.length ? focusLessons : [current.current_lesson],
    level_hint: current.current_lesson <= 8 ? 'N5 foundation' : 'N5-N4 bridge',
    goals: profile.goals.slice(0, 4),
    grammar_focus: pickGrammarFocus({ current, mastery }),
    listening_focus: unique([
      ...(current.recent_focus?.listening || []),
      ...(current.recent_focus?.speaking || [])
    ]).slice(0, 6),
    mistake_signals: summarizeMistakeTags(mistakeBook),
    vocabulary_targets: materializeVocabularyTargets({
      catalog,
      progress: vocabularyProgress,
      selection: vocabularySelection,
      date: timestamp
    })
  })
}

export { buildListeningSourceSnapshot, materializeVocabularyTargets, summarizeMistakeTags }
