import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadVocabularyCatalog } from '../src/server/agentStudy/vocabularyCatalog.js'
import {
  createAgentStudyVocabularyStore,
  selectVocabularyItems
} from '../src/server/agentStudy/vocabularyStore.js'
import {
  createSampleDailyPacket,
  createSampleReviewResult
} from './helpers/agentStudyRuntimeFixtures.js'

const tempDirs = []

const createStudyRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-vocabulary-'))
  tempDirs.push(root)
  const studyRoot = path.join(root, 'study')
  for (const directory of ['state', 'daily', 'reviews', 'context']) {
    fs.mkdirSync(path.join(studyRoot, directory), { recursive: true })
  }
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const findVocabulary = (word) =>
  loadVocabularyCatalog().items.find((item) => item.word === word)

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agent study vocabulary store', () => {
  it('loads a unique 300-word N5/N4 catalog', () => {
    const catalog = loadVocabularyCatalog()
    expect(catalog.items).toHaveLength(300)
    expect(new Set(catalog.items.map((item) => item.id)).size).toBe(300)
    expect(catalog.items.filter((item) => item.estimated_level === 'N5')).toHaveLength(182)
    expect(catalog.items.filter((item) => item.estimated_level === 'N4')).toHaveLength(118)
  })

  it('records vocabulary success independently from whole-question correctness', () => {
    const studyRoot = createStudyRoot()
    const bus = findVocabulary('バス')
    const material = findVocabulary('資料')
    const send = findVocabulary('送る')
    const daily = createSampleDailyPacket({ status: 'submitted' })
    daily.exercises[0].metadata.target_vocabulary_ids = [bus.id]
    daily.exercises[1].metadata.target_vocabulary_ids = [material.id, send.id]
    daily.exercises[1].metadata.skill = 'reading'

    const review = createSampleReviewResult()
    review.items[1].is_correct = false
    review.items[1].error_tags = ['vocabulary']
    review.items[1].vocabulary_feedback = [
      { dictionary_form: '送る', meaning: '发送' }
    ]

    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), daily)
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), review)

    const store = createAgentStudyVocabularyStore({
      studyRoot,
      now: () => '2026-06-27T09:00:00+08:00'
    })
    const book = store.loadVocabularyBook({ date: '2026-06-27' })
    const byId = new Map(book.items.map((item) => [item.id, item]))

    expect(byId.get(bus.id)).toMatchObject({
      seen_count: 1,
      correct_count: 1,
      last_result: 'correct'
    })
    expect(byId.get(bus.id).modes.production.correct_count).toBe(1)
    expect(byId.get(material.id)).toMatchObject({
      seen_count: 1,
      correct_count: 1
    })
    expect(byId.get(material.id).modes.reading.correct_count).toBe(1)
    expect(byId.get(send.id)).toMatchObject({
      seen_count: 1,
      correct_count: 0,
      last_result: 'wrong',
      is_due: true
    })

    const reloaded = store.loadVocabularyBook({ date: '2026-06-27' })
    expect(reloaded.progress.processed_review_ids).toEqual(['review-2026-06-26'])
    expect(reloaded.items.find((item) => item.id === bus.id).seen_count).toBe(1)
  })

  it('selects due words first, introduces new words, and writes a compact snapshot', () => {
    const studyRoot = createStudyRoot()
    const store = createAgentStudyVocabularyStore({
      studyRoot,
      now: () => '2026-07-23T09:00:00+08:00'
    })

    const selection = store.selectForPacket({
      lesson: 6,
      date: '2026-07-23',
      count: 18
    })

    expect(selection.items).toHaveLength(18)
    expect(
      selection.items.every((item) => ['new', 'rotation'].includes(item.selection_reason))
    ).toBe(true)
    expect(selection.items.map((item) => item.priority_rank)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1)
    )
    expect(
      fs.existsSync(path.join(studyRoot, 'context', 'vocabulary-selection.json'))
    ).toBe(true)
  })

  it('keeps the selector allocation bounded and deterministic', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      id: `v-${index}`,
      priority_rank: index + 1,
      status: index < 4 ? 'learning' : 'new',
      is_due: index < 4,
      last_result: index < 2 ? 'wrong' : 'correct',
      due_date: '2026-07-23'
    }))

    const selected = selectVocabularyItems({ items, count: 10 })
    expect(selected).toHaveLength(10)
    expect(selected.slice(0, 3).map((item) => item.id)).toEqual(['v-0', 'v-1', 'v-2'])
    expect(selected.filter((item) => item.status === 'new').length).toBeGreaterThanOrEqual(6)
  })
})
