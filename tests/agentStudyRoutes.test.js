import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyEventLog } from '../src/server/agentStudy/eventLog.js'
import { createAgentStudyFileStore } from '../src/server/agentStudy/fileStore.js'
import {
  handleGetLatestAgentStudy,
  handleGetLatestReview,
  handleSaveDailyPacket,
  handleSubmitDailyPacket
} from '../src/server/agentStudy/routes.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-routes-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'prompts', 'generated'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'logs'), { recursive: true })
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const createIndexDocument = ({ latestReview = null } = {}) => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-30T09:00:00+08:00',
  latest_daily: 'study/daily/2026-06-30.json',
  latest_prompt: null,
  latest_review: latestReview,
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

const createDailyPacket = ({ date = '2026-06-30', revision = 1, status = 'planned' } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: date + 'T09:00:00+08:00',
  id: 'daily-' + date,
  date,
  status,
  created_at: date + 'T09:00:00+08:00',
  mission: {
    title: 'Lesson 7 review',
    plan_type: 'review_then_output',
    available_minutes: 40,
    focus_lessons: [7],
    goals: ['stabilize lesson 7']
  },
  tasks: [
    {
      id: 'task-1',
      type: 'listening_shadowing',
      title: 'Shadow a lesson 7 dialogue',
      minutes: 20,
      required: true,
      status: 'pending'
    }
  ],
  study_materials: [
    {
      id: 'material-1',
      type: 'grammar_note',
      lesson: 7,
      title: 'Means particle',
      content: 'Use で for means and tools.',
      examples: [
        { ja: 'バスで 行きます。', zh: '坐公交去。', note: 'means example' },
        { ja: 'はしで 食べます。', zh: '用筷子吃。', note: 'tool example' }
      ]
    },
    {
      id: 'material-2',
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
      review_queue_id: 'rq-001',
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

const createReviewResult = ({ date = '2026-06-30' } = {}) => ({
  schema_version: 1,
  revision: 1,
  updated_at: date + 'T12:00:00+08:00',
  id: 'review-' + date,
  daily_id: 'daily-' + date,
  created_at: date + 'T12:00:00+08:00',
  overall: {
    accuracy: 0.8,
    can_advance: false,
    summary: 'Needs another pass.',
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

describe('agentStudyRoutes', () => {
  it('loads latest agent study state through store-backed handlers', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-30.json'), createDailyPacket())
    writeJson(
      path.join(studyRoot, 'reviews', '2026-06-30-review.json'),
      createReviewResult()
    )
    writeJson(
      path.join(studyRoot, 'index.json'),
      createIndexDocument({ latestReview: 'study/reviews/2026-06-30-review.json' })
    )

    const fileStore = createAgentStudyFileStore({ studyRoot })
    const latest = await handleGetLatestAgentStudy({ fileStore })
    const latestReview = await handleGetLatestReview({ fileStore })

    expect(latest.index.latest_daily).toBe('study/daily/2026-06-30.json')
    expect(latest.dailyPacket.id).toBe('daily-2026-06-30')
    expect(latest.reviewResult.id).toBe('review-2026-06-30')
    expect(latestReview.id).toBe('review-2026-06-30')
  })

  it('saves a daily packet draft and returns the updated packet', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-30.json'), createDailyPacket())
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())

    const fileStore = createAgentStudyFileStore({
      studyRoot,
      now: () => '2026-06-30T10:00:00+08:00'
    })
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      now: () => '2026-06-30T10:00:00+08:00',
      createId: () => 'event-save-1'
    })

    const payload = createDailyPacket({ revision: 1, status: 'learning' })
    payload.answers['ex-001'] = 'バスで 行きます。'

    const result = await handleSaveDailyPacket(
      { dailyPacket: payload },
      { fileStore, eventLog }
    )

    expect(result.dailyPacket.answers['ex-001']).toBe('バスで 行きます。')
    expect(result.targetPath).toBe('study/daily/2026-06-30.json')
    const logLines = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
    expect(logLines).toHaveLength(1)
    expect(JSON.parse(logLines[0]).event).toBe('daily_saved')
  })

  it('submits a daily packet and appends a submit event', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(
      path.join(studyRoot, 'daily', '2026-06-30.json'),
      createDailyPacket({ status: 'answering' })
    )
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())

    const fileStore = createAgentStudyFileStore({
      studyRoot,
      now: () => '2026-06-30T11:00:00+08:00'
    })
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      now: () => '2026-06-30T11:00:00+08:00',
      createId: () => 'event-submit-1'
    })

    const payload = createDailyPacket({ revision: 1, status: 'answering' })
    payload.answers['ex-001'] = 'バスで 行きます。'

    const result = await handleSubmitDailyPacket(
      { dailyPacket: payload },
      { fileStore, eventLog }
    )

    expect(result.dailyPacket.status).toBe('submitted')
    const logLines = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
    expect(logLines).toHaveLength(1)
    expect(JSON.parse(logLines[0]).event).toBe('daily_submitted')
  })

  it('rejects invalid payloads before touching storage', async () => {
    await expect(handleSaveDailyPacket(null)).rejects.toThrow(/requires a JSON object payload/)
    await expect(handleSubmitDailyPacket({})).rejects.toThrow(/dailyPacket/)
  })
})
