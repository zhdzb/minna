import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateIndex } from '../src/utils/agentStudySchema'
import { createAgentStudyFileStore, resolveStudyPath } from '../src/server/agentStudy/fileStore'

const tempDirs = []

const readStudyJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'))

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-store-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'prompts', 'generated'), { recursive: true })
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const createIndexDocument = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-26T00:00:00+08:00',
  latest_daily: 'study/daily/2026-06-26.json',
  latest_prompt: null,
  latest_review: null,
  schema_versions: {
    index: 1,
    profile: 1,
    current: 1,
    mastery: 1,
    review_queue: 1,
    promotion_rules: 1,
    daily_packet: 1,
    review_result: 1
  }
})

const createDailyPacket = ({ date = '2026-06-26', revision = 1, status = 'planned' } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: date + 'T00:00:00+08:00',
  id: 'daily-' + date,
  date,
  status,
  created_at: date + 'T00:00:00+08:00',
  mission: {
    title: 'Lesson 7 review',
    plan_type: 'review_then_output',
    available_minutes: 40,
    focus_lessons: [7],
    goals: ['stabilize lesson 7']
  },
  tasks: [
    {
      id: 'task-shadowing',
      type: 'listening_shadowing',
      title: 'Shadow the sample dialogue',
      minutes: 20,
      required: true,
      status: 'pending'
    }
  ],
  study_materials: [
    {
      id: 'material-grammar',
      type: 'grammar_note',
      lesson: 7,
      title: 'Means particle',
      content: 'Use で for means and tools.',
      examples: [
        { ja: 'バスで 行きます。', zh: '坐公交去。', note: 'tool example' },
        { ja: 'はしで 食べます。', zh: '用筷子吃。', note: 'means example' }
      ]
    },
    {
      id: 'material-listening',
      type: 'listening_script',
      lesson: 7,
      title: 'Dialogue script',
      content: 'A: 何で 行きますか。 B: バスで 行きます。',
      examples: [
        { ja: '何で 行きますか。', zh: '怎么去？', note: 'question' },
        { ja: 'バスで 行きます。', zh: '坐公交去。', note: 'answer' }
      ]
    }
  ],
  review_items: [
    {
      review_queue_id: 'rq-lesson-7-tool-means',
      lesson: 7,
      skill: 'grammar',
      target_grammar: 'N で V'
    }
  ],
  exercises: [
    {
      id: 'ex-001',
      type: 'q_translate',
      lesson: 7,
      target_grammar: 'N で V',
      prompt: 'Translate: I go by bus.',
      vocab_hints: ['バス'],
      answer_reference: 'バスで 行きます。',
      metadata: {
        source: 'codex',
        difficulty: 'foundation',
        skill: 'output'
      }
    }
  ],
  answers: {
    'ex-001': ''
  },
  self_assessment: {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: '',
    note: ''
  },
  correction: {
    status: 'pending',
    prompt_file: '',
    review_file: ''
  },
  review_result: null
})

const createReviewResult = ({ date = '2026-06-26' } = {}) => ({
  schema_version: 1,
  revision: 1,
  updated_at: date + 'T10:00:00+08:00',
  id: 'review-' + date,
  daily_id: 'daily-' + date,
  created_at: date + 'T10:00:00+08:00',
  overall: {
    accuracy: 0.8,
    can_advance: false,
    summary: 'Need another pass.',
    next_focus: ['means particle']
  },
  items: [
    {
      exercise_id: 'ex-001',
      is_correct: false,
      score: 0.5,
      error_tags: ['particle'],
      target_grammar: 'N で V',
      user_answer: '',
      correct_answer: 'バスで 行きます。',
      explanation: 'Missing the means particle.',
      retry_recommended: true
    }
  ],
  mastery_updates: [],
  review_queue_updates: [],
  promotion_decision: {
    can_advance: false,
    reason: 'Not enough accuracy yet.'
  }
})

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyFileStore', () => {
  it('reads the seed index and latest daily packet', () => {
    const store = createAgentStudyFileStore()

    expect(store.loadIndex().latest_daily).toBe('study/daily/2026-06-26.json')
    expect(store.loadLatestDaily().id).toBe(readStudyJson('study/daily/2026-06-26.json').id)
    expect(store.loadLatestReview()).toBe(null)
  })

  it('writes a daily packet copy with atomic replacement and updates index', () => {
    const studyRoot = createTempStudyRoot()
    const seedDaily = createDailyPacket()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), seedDaily)
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())

    const store = createAgentStudyFileStore({
      studyRoot,
      now: () => '2026-06-27T09:00:00+08:00'
    })

    const nextDaily = createDailyPacket({
      date: '2026-06-27',
      revision: 1,
      status: 'learning'
    })
    nextDaily.id = 'daily-2026-06-27'
    nextDaily.answers['ex-001'] = 'バスで 行きます。'

    const saved = store.saveDailyDraft({
      dailyPacket: nextDaily,
      targetPath: 'study/daily/2026-06-27.json'
    })

    expect(saved.revision).toBe(1)
    expect(saved.updated_at).toBe('2026-06-27T09:00:00+08:00')
    expect(saved.answers['ex-001']).toBe('バスで 行きます。')

    const writtenDaily = JSON.parse(
      fs.readFileSync(path.join(studyRoot, 'daily', '2026-06-27.json'), 'utf8')
    )
    const writtenIndex = validateIndex(
      JSON.parse(fs.readFileSync(path.join(studyRoot, 'index.json'), 'utf8'))
    )

    expect(writtenDaily.answers['ex-001']).toBe('バスで 行きます。')
    expect(fs.existsSync(path.join(studyRoot, 'daily', '2026-06-27.json.tmp'))).toBe(false)
    expect(writtenIndex.latest_daily).toBe('study/daily/2026-06-27.json')
    expect(writtenIndex.revision).toBe(2)
  })

  it('submits a daily packet by bumping revision and forcing submitted status', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), createDailyPacket())
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), createReviewResult())
    writeJson(path.join(studyRoot, 'index.json'), {
      ...createIndexDocument(),
      latest_review: 'study/reviews/2026-06-26-review.json'
    })

    const store = createAgentStudyFileStore({
      studyRoot,
      now: () => '2026-06-26T18:00:00+08:00'
    })

    const currentDaily = JSON.parse(
      fs.readFileSync(path.join(studyRoot, 'daily', '2026-06-26.json'), 'utf8')
    )
    currentDaily.status = 'answering'
    currentDaily.answers['ex-001'] = 'バスで 行きます。'

    const submitted = store.submitDailyPacket({
      dailyPacket: currentDaily,
      targetPath: 'study/daily/2026-06-26.json'
    })

    expect(submitted.status).toBe('submitted')
    expect(submitted.revision).toBe(2)
    expect(store.loadLatestReview().id).toBe('review-2026-06-26')
  })

  it('rejects path traversal outside the study directory', () => {
    const studyRoot = createTempStudyRoot()

    expect(() => resolveStudyPath(studyRoot, 'study/../index.json')).toThrow(/inside the study directory/)
    expect(() =>
      createAgentStudyFileStore({ studyRoot }).saveDailyDraft({
        dailyPacket: createDailyPacket(),
        targetPath: 'study/../daily/2026-06-26.json'
      })
    ).toThrow(/inside the study directory/)
  })

  it('rejects revision conflicts when saving over a newer file', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), createDailyPacket({ revision: 2 }))
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())

    const store = createAgentStudyFileStore({ studyRoot })
    const staleDaily = createDailyPacket({ revision: 1 })
    staleDaily.answers['ex-001'] = '古い回答'

    expect(() =>
      store.saveDailyDraft({
        dailyPacket: staleDaily,
        targetPath: 'study/daily/2026-06-26.json'
      })
    ).toThrow(/Revision conflict/)
  })
})
