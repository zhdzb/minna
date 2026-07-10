import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateIndex } from '../src/utils/agentStudySchema'
import {
  buildRebuiltIndex,
  loadAgentStudyIndexWithFallback,
  rebuildAgentStudyIndex
} from '../src/server/agentStudy/indexRebuilder'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-index-'))
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

const createDailyPacket = ({ date, revision = 1 } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: date + 'T00:00:00+08:00',
  id: 'daily-' + date,
  date,
  status: 'planned',
  created_at: date + 'T00:00:00+08:00',
  mission: {
    title: 'Lesson 7 review',
    plan_type: 'review_then_output',
    available_minutes: 40,
    focus_lessons: [7],
    goals: ['stabilize lesson 7']
  },
  tasks: [],
  study_materials: [],
  review_items: [],
  exercises: [],
  answers: {},
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

const createReviewResult = ({ date, revision = 1 } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: date + 'T10:00:00+08:00',
  id: 'review-' + date,
  daily_id: 'daily-' + date,
  created_at: date + 'T10:00:00+08:00',
  overall: {
    accuracy: 0.8,
    can_advance: false,
    summary: 'Needs more repetition.',
    next_focus: ['lesson 7 particles']
  },
  items: [
    {
      exercise_id: 'ex-001',
      is_correct: false,
      score: 0.5,
      error_tags: ['particle'],
      target_grammar: 'N で V',
      user_answer: '',
      correct_answer: 'バスで いきます。',
      explanation: 'Means particle is missing.',
      retry_recommended: true
    }
  ],
  mastery_updates: [],
  review_queue_updates: [],
  promotion_decision: {
    can_advance: false,
    reason: 'Need another correct output session.'
  }
})

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyIndexRebuilder', () => {
  it('rebuilds the seeded study index from on-disk facts', () => {
    const studyRoot = path.resolve(process.cwd(), 'study')

    const rebuilt = buildRebuiltIndex({
      studyRoot,
      updatedAt: '2026-07-01T12:00:00+08:00'
    })

    expect(validateIndex(rebuilt)).toEqual(rebuilt)
    expect(rebuilt.latest_daily).toBe('study/daily/2026-07-11.json')
    expect(rebuilt.latest_review).toBe('study/reviews/2026-07-10-review.json')
    expect(rebuilt.latest_prompt).toBe('study/prompts/generated/2026-07-11-review.md')
  })

  it('falls back to rebuilding and writing index when index.json is missing or corrupted', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), createDailyPacket({ date: '2026-06-26' }))
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), createReviewResult({ date: '2026-06-26' }))
    fs.writeFileSync(path.join(studyRoot, 'prompts', 'generated', '2026-06-26-review.md'), '# prompt\n', 'utf8')
    fs.writeFileSync(path.join(studyRoot, 'index.json'), '{broken json', 'utf8')

    const rebuilt = loadAgentStudyIndexWithFallback({
      studyRoot,
      updatedAt: '2026-06-27T09:00:00+08:00'
    })

    expect(rebuilt.latest_daily).toBe('study/daily/2026-06-26.json')
    expect(rebuilt.latest_review).toBe('study/reviews/2026-06-26-review.json')
    expect(rebuilt.latest_prompt).toBe('study/prompts/generated/2026-06-26-review.md')
    expect(validateIndex(JSON.parse(fs.readFileSync(path.join(studyRoot, 'index.json'), 'utf8')))).toEqual(rebuilt)
  })

  it('skips invalid newest candidates and keeps the latest validated files', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), createDailyPacket({ date: '2026-06-26' }))
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), createReviewResult({ date: '2026-06-26' }))
    fs.writeFileSync(path.join(studyRoot, 'prompts', 'generated', '2026-06-26-review.md'), '# old prompt\n', 'utf8')
    fs.writeFileSync(path.join(studyRoot, 'prompts', 'generated', '2026-06-27-review.md'), '# new prompt\n', 'utf8')

    writeJson(path.join(studyRoot, 'daily', '2026-06-27.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-27T00:00:00+08:00'
    })
    writeJson(path.join(studyRoot, 'reviews', '2026-06-27-review.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-27T10:00:00+08:00'
    })

    const rebuilt = rebuildAgentStudyIndex({
      studyRoot,
      updatedAt: '2026-06-27T12:00:00+08:00',
      write: false
    })

    expect(rebuilt.latest_daily).toBe('study/daily/2026-06-26.json')
    expect(rebuilt.latest_review).toBe('study/reviews/2026-06-26-review.json')
    expect(rebuilt.latest_prompt).toBe('study/prompts/generated/2026-06-27-review.md')
  })
})
