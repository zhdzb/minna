import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentStudyEventLog } from '../src/server/agentStudy/eventLog.js'
import { createAgentStudyFileStore } from '../src/server/agentStudy/fileStore.js'
import {
  handleGetAgentProgressReview,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleGetLatestReviewDrill,
  handleGetLatestReview,
  handleGetSyllabus,
  handleSaveDailyPacket,
  handleSaveSyllabus,
  handleSaveReviewDrill,
  handleSubmitReviewDrill,
  handleSubmitDailyPacket
} from '../src/server/agentStudy/routes.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-routes-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'review-drills'), { recursive: true })
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

const createProfile = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-30T09:00:00+08:00',
  learner_id: 'learner-001',
  goals: ['stabilize lesson 7 output', 'build speaking confidence'],
  daily_time_budget_minutes: 45,
  pace_preference: 'steady',
  input_preferences: {
    allow_romaji: false,
    prefer_kana_first: true,
    practice_kanji: true,
    ui_language: 'zh-CN'
  },
  material_scope: {
    series: 'Minna no Nihongo',
    current_focus_lessons: [7],
    allow_new_lessons: false
  },
  notes: ['Keep review pressure manageable']
})

const createCurrent = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-30T09:00:00+08:00',
  current_lesson: 7,
  learning_mode: 'foundation_rebuild',
  active_goals: ['stabilize lesson 7 output'],
  weakness_summary: [
    {
      scope: 'grammar_point',
      key: 'lesson-7/tool-means',
      problem: 'Means particle still unstable.',
      evidence: ['review-2026-06-30']
    }
  ],
  recent_focus: {
    grammar: ['N ? V'],
    listening: ['lesson 7 keywords'],
    speaking: ['short replies']
  },
  next_recommendation: {
    date: '2026-06-30',
    plan_type: 'review_then_output',
    minutes: 45
  }
})

const createMastery = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-30T09:00:00+08:00',
  current_gate: 'lesson-7-foundation',
  lesson_states: {
    'lesson-7': {
      lesson: 7,
      status: 'weak',
      skill_scores: {
        grammar: 0.44,
        listening: 0.36,
        speaking: 0.33,
        reading: 0.51
      },
      last_reviewed_at: '2026-06-30T08:30:00+08:00'
    }
  },
  grammar_points: {
    'lesson-7/tool-means': {
      lesson: 7,
      pattern: 'N ? V',
      status: 'weak',
      recognition: 0.4,
      controlled_output: 0.15,
      free_output: 0.05,
      last_practiced_at: '2026-06-30T08:30:00+08:00'
    }
  }
})

const createReviewQueue = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-30T09:00:00+08:00',
  items: [
    {
      id: 'rq-001',
      kind: 'grammar_point',
      key: 'lesson-7/tool-means',
      status: 'due',
      due_date: '2026-06-30',
      interval_days: 1,
      ease: 2.1,
      last_result: 'wrong'
    }
  ]
})

const createReviewDrill = ({ revision = 1, status = 'draft' } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: '2026-06-30T09:00:00+08:00',
  id: 'review-drill-2026-06-30',
  date: '2026-06-30',
  status,
  created_at: '2026-06-30T09:00:00+08:00',
  source_review: 'study/reviews/2026-06-30-review.json',
  summary: {
    title: 'Lesson 7 weak point refresh',
    focus: ['means particle', 'morau response'],
    due_review_queue_ids: ['rq-001']
  },
  items: [
    {
      id: 'drill-001',
      review_queue_id: 'rq-001',
      key: 'lesson-7/tool-means',
      lesson: 7,
      target_grammar: 'N de V',
      weakness_explanation: 'The means particle still slips during controlled output.',
      error_tags: ['particle'],
      original_prompt: 'Translate: I go by bus.',
      variant_prompt: 'Say: I go to the station by taxi today.',
      answer_reference: 'Kyou wa takushii de eki ni ikimasu.',
      user_answer: '',
      hint: 'Keep de attached to the transport phrase.',
      status: 'pending'
    }
  ],
  submission: {
    submitted_at: null,
    note: ''
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

  it('loads the latest review drill packet', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())
    writeJson(path.join(studyRoot, 'review-drills', '2026-06-30.json'), createReviewDrill())

    const fileStore = createAgentStudyFileStore({ studyRoot })
    const latestReviewDrill = await handleGetLatestReviewDrill({ fileStore })

    expect(latestReviewDrill.id).toBe('review-drill-2026-06-30')
  })

  it('loads the aggregated progress review payload', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-30.json'), createDailyPacket())
    writeJson(
      path.join(studyRoot, 'reviews', '2026-06-30-review.json'),
      createReviewResult()
    )
    writeJson(path.join(studyRoot, 'state', 'profile.json'), createProfile())
    writeJson(path.join(studyRoot, 'state', 'current.json'), createCurrent())
    writeJson(path.join(studyRoot, 'state', 'mastery.json'), createMastery())
    writeJson(path.join(studyRoot, 'state', 'review-queue.json'), createReviewQueue())
    writeJson(
      path.join(studyRoot, 'index.json'),
      createIndexDocument({ latestReview: 'study/reviews/2026-06-30-review.json' })
    )
    fs.mkdirSync(path.join(studyRoot, 'context'), { recursive: true })
    fs.writeFileSync(
      path.join(studyRoot, 'context', 'next-agent-context.md'),
      '# Next Agent Context\n- Read study/state/current.json first.\n',
      'utf8'
    )

    const fileStore = createAgentStudyFileStore({ studyRoot })
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      createId: () => 'event-progress-1'
    })
    eventLog.appendEvent({
      time: '2026-06-30T09:10:00+08:00',
      actor: 'codex',
      event: 'review_applied',
      input_files: ['study/daily/2026-06-30.json'],
      output_files: ['study/state/mastery.json'],
      summary: 'Applied latest review.'
    })

    const result = await handleGetAgentProgressReview({ fileStore, eventLog })

    expect(result.profile.learner_id).toBe('learner-001')
    expect(result.current.current_lesson).toBe(7)
    expect(result.mastery.current_gate).toBe('lesson-7-foundation')
    expect(result.reviewQueue.items).toHaveLength(1)
    expect(result.reviewResult.id).toBe('review-2026-06-30')
    expect(result.recentEvents[0].event).toBe('review_applied')
    expect(result.nextAgentContext.path).toBe('study/context/next-agent-context.md')
    expect(result.nextAgentContext.content).toContain('Read study/state/current.json first.')
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

  it('reads a generated review prompt file through the prompt handler', async () => {
    const studyRoot = createTempStudyRoot()
    const promptPath = path.join(studyRoot, 'prompts', 'generated', '2026-06-30-review.md')
    fs.writeFileSync(promptPath, 'Review prompt body', 'utf8')

    const fileStore = createAgentStudyFileStore({ studyRoot })
    const result = await handleGetPromptFile(
      { path: 'study/prompts/generated/2026-06-30-review.md' },
      { fileStore }
    )

    expect(result).toEqual({
      path: 'study/prompts/generated/2026-06-30-review.md',
      content: 'Review prompt body'
    })
  })

  it('loads and saves syllabus documents through the syllabus store', async () => {
    const syllabusStore = {
      loadSyllabus: vi.fn().mockReturnValue({ lessons: [], question_types: [] }),
      saveSyllabus: vi.fn().mockReturnValue({ saved: true })
    }
    const payload = {
      lessons: [{ id: 1 }],
      question_types: [{ id: 'q_fill' }]
    }

    await expect(handleGetSyllabus({ syllabusStore })).resolves.toEqual({ lessons: [], question_types: [] })
    await expect(handleSaveSyllabus(payload, { syllabusStore })).resolves.toEqual({ saved: true })
    expect(syllabusStore.loadSyllabus).toHaveBeenCalledTimes(1)
    expect(syllabusStore.saveSyllabus).toHaveBeenCalledWith(payload)
  })

  it('saves and submits a review drill packet while appending drill events', async () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'index.json'), createIndexDocument())
    writeJson(path.join(studyRoot, 'review-drills', '2026-06-30.json'), createReviewDrill())

    const fileStore = createAgentStudyFileStore({
      studyRoot,
      now: () => '2026-06-30T12:00:00+08:00'
    })
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      now: () => '2026-06-30T12:00:00+08:00',
      createId: (() => {
        let count = 0
        return () => 'event-review-drill-' + ++count
      })()
    })

    const draft = createReviewDrill()
    draft.items[0].user_answer = 'Kyou wa takushii de eki ni ikimasu.'

    const saved = await handleSaveReviewDrill({ reviewDrill: draft }, { fileStore, eventLog })
    expect(saved.reviewDrill.revision).toBe(2)
    expect(saved.reviewDrill.items[0].user_answer).toContain('takushii')

    const submitted = await handleSubmitReviewDrill(
      { reviewDrill: saved.reviewDrill },
      { fileStore, eventLog }
    )
    expect(submitted.reviewDrill.status).toBe('submitted')

    const logLines = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
    expect(logLines).toHaveLength(2)
    expect(JSON.parse(logLines[0]).event).toBe('review_drill_saved')
    expect(JSON.parse(logLines[1]).event).toBe('review_drill_submitted')
  })

  it('rejects invalid payloads before touching storage', async () => {
    await expect(handleSaveDailyPacket(null)).rejects.toThrow(/requires a JSON object payload/)
    await expect(handleSubmitDailyPacket({})).rejects.toThrow(/dailyPacket/)
    await expect(handleGetPromptFile({ path: '' })).rejects.toThrow(/requires a prompt path/)
    await expect(handleSaveReviewDrill({})).rejects.toThrow(/reviewDrill/)
  })
})
