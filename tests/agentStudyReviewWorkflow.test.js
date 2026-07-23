import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyReviewWorkflow } from '../src/server/agentStudy/reviewWorkflow.js'
import {
  createSampleDailyPacket,
  createSampleReviewResult
} from './helpers/agentStudyRuntimeFixtures'

const tempDirs = []
const repoRoot = process.cwd()

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-review-workflow-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.cpSync(path.join(repoRoot, 'study'), studyRoot, { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'prompts', 'generated'), { recursive: true })
  return studyRoot
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const seedWorkflowState = (studyRoot) => {
  const dailyPacket = createSampleDailyPacket({
    date: '2026-06-26',
    status: 'submitted'
  })
  dailyPacket.correction.prompt_file = 'study/prompts/generated/2026-06-26-review.md'
  writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), dailyPacket)

  const reviewResult = createSampleReviewResult({ date: '2026-06-26' })
  writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), reviewResult)
  fs.writeFileSync(
    path.join(studyRoot, 'prompts', 'generated', '2026-06-26-review.md'),
    '# review prompt\n',
    'utf8'
  )

  writeJson(path.join(studyRoot, 'state', 'mastery.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-06-26T20:30:00+08:00',
    current_gate: 'lesson-7-foundation',
    lesson_states: {
      'lesson-7': {
        lesson: 7,
        status: 'learning',
        skill_scores: {
          grammar: 0.52,
          listening: 0.2,
          speaking: 0.28,
          reading: 0.34
        },
        last_reviewed_at: '2026-06-25T20:00:00+08:00'
      }
    },
    grammar_points: {
      'lesson-7/tool-means': {
        lesson: 7,
        pattern: 'N で V',
        status: 'learning',
        recognition: 0.6,
        controlled_output: 0.18,
        free_output: 0.12,
        last_practiced_at: '2026-06-25T20:00:00+08:00'
      }
    }
  })

  writeJson(path.join(studyRoot, 'state', 'review-queue.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-06-26T20:30:00+08:00',
    items: [
      {
        id: 'rq-lesson-7-tool-means',
        kind: 'grammar_point',
        key: 'lesson-7/tool-means',
        status: 'due',
        due_date: '2026-06-26',
        interval_days: 1,
        ease: 2,
        last_result: 'wrong'
      }
    ]
  })

  writeJson(path.join(studyRoot, 'state', 'current.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-06-26T20:30:00+08:00',
    current_lesson: 7,
    learning_mode: 'foundation_rebuild',
    active_goals: ['重建第 7 课输出', '稳定手段助词'],
    weakness_summary: [],
    recent_focus: {
      grammar: ['N で V'],
      listening: ['第 7 课听力'],
      speaking: ['第 7 课受控输出']
    },
    next_recommendation: {
      date: '2026-06-26',
      plan_type: 'review_then_output',
      minutes: 40
    }
  })

  writeJson(path.join(studyRoot, 'index.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-06-26T20:30:00+08:00',
    latest_daily: 'study/daily/2026-06-26.json',
    latest_prompt: 'study/prompts/generated/2026-06-26-review.md',
    latest_review: null,
    schema_versions: {
      index: 1,
      profile: 1,
      current: 1,
      mastery: 1,
      review_queue: 1,
      promotion_rules: 1,
      daily_packet: 1,
      review_result: 1,
      review_drill: 1
    }
  })

  fs.writeFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), '', 'utf8')

  return {
    dailyPacket,
    reviewResult
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyReviewWorkflow', () => {
  it('applies a submitted review result and refreshes study state in order', () => {
    const studyRoot = createTempStudyRoot()
    const { dailyPacket, reviewResult } = seedWorkflowState(studyRoot)

    const workflow = createAgentStudyReviewWorkflow({
      studyRoot,
      now: () => '2026-06-30T09:15:00+08:00'
    })

    const result = workflow.applyReviewResult({
      dailyPacket,
      reviewResult
    })

    const updatedDaily = readJson(path.join(studyRoot, 'daily', '2026-06-26.json'))
    const updatedMastery = readJson(path.join(studyRoot, 'state', 'mastery.json'))
    const updatedReviewQueue = readJson(path.join(studyRoot, 'state', 'review-queue.json'))
    const updatedCurrent = readJson(path.join(studyRoot, 'state', 'current.json'))
    const updatedIndex = readJson(path.join(studyRoot, 'index.json'))
    const contextContent = fs.readFileSync(path.join(studyRoot, 'context', 'next-agent-context.md'), 'utf8')
    const writtenReview = readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'))
    const mistakeBook = readJson(path.join(studyRoot, 'state', 'mistakes.json'))

    expect(result.reviewPath).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedDaily.status).toBe('reviewed')
    expect(updatedDaily.correction.status).toBe('reviewed')
    expect(updatedDaily.correction.review_file).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedDaily.review_result.id).toBe('review-2026-06-26')
    expect(updatedMastery.grammar_points['lesson-7/tool-means'].status).toBe('weak')
    expect(updatedReviewQueue.items[0].status).toBe('due')
    expect(updatedCurrent.learning_mode).toBe('foundation_rebuild')
    expect(updatedCurrent.next_recommendation.plan_type).toBe('review_then_output')
    expect(updatedCurrent.weakness_summary[0].key).toBe('ex-001')
    expect(updatedIndex.latest_review).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedIndex.latest_daily).toBe('study/daily/2026-06-26.json')
    expect(contextContent).toContain('最新 review：study/reviews/2026-06-26-review.json')
    expect(writtenReview.id).toBe('review-2026-06-26')
    expect(
      mistakeBook.items.find((item) => item.id === 'mistake:review-2026-06-26:ex-001')
    ).toMatchObject({
      exercise_id: 'ex-001',
      review_id: 'review-2026-06-26'
    })
    expect(
      mistakeBook.items.some((item) => item.exercise_id === 'ex-002' && item.review_id === 'review-2026-06-26')
    ).toBe(false)
  })

  it('does not update index when a later workflow step fails', () => {
    const studyRoot = createTempStudyRoot()
    const { dailyPacket, reviewResult } = seedWorkflowState(studyRoot)
    const originalIndex = readJson(path.join(studyRoot, 'index.json'))

    const workflow = createAgentStudyReviewWorkflow({
      studyRoot,
      now: () => '2026-06-30T09:20:00+08:00',
      contextWriter: {
        writeNextAgentContext() {
          throw new Error('context writer unavailable')
        }
      }
    })

    expect(() =>
      workflow.applyReviewResult({
        dailyPacket,
        reviewResult
      })
    ).toThrow(/context writer unavailable/)

    expect(readJson(path.join(studyRoot, 'index.json'))).toEqual(originalIndex)
    expect(readJson(path.join(studyRoot, 'daily', '2026-06-26.json')).status).toBe('reviewed')
    expect(readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json')).id).toBe('review-2026-06-26')
  })
})
