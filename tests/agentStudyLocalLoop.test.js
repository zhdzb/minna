import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  handleGetAgentProgressReview,
  handleGetLatestAgentStudy,
  handleGetPromptFile,
  handleSaveDailyPacket,
  handleSubmitDailyPacket
} from '../src/server/agentStudy/routes.js'
import { createAgentStudyEventLog } from '../src/server/agentStudy/eventLog.js'
import { createAgentStudyFileStore } from '../src/server/agentStudy/fileStore.js'
import { createAgentStudyReviewWorkflow } from '../src/server/agentStudy/reviewWorkflow.js'
import {
  createSampleDailyPacket,
  createSampleReviewResult
} from './helpers/agentStudyRuntimeFixtures'

const repoRoot = process.cwd()
const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-local-loop-'))
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

const seedLoopState = (studyRoot) => {
  const daily = createSampleDailyPacket({ date: '2026-06-26', status: 'planned' })
  daily.correction.prompt_file = 'study/prompts/generated/2026-06-26-review.md'
  writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), daily)
  fs.writeFileSync(path.join(studyRoot, 'prompts', 'generated', '2026-06-26-review.md'), '# review prompt\n', 'utf8')

  writeJson(path.join(studyRoot, 'state', 'mastery.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
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
        last_reviewed_at: '2026-06-30T09:00:00+08:00'
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
        last_practiced_at: '2026-06-30T09:00:00+08:00'
      }
    }
  })

  writeJson(path.join(studyRoot, 'state', 'review-queue.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    items: [
      {
        id: 'rq-lesson-7-tool-means',
        kind: 'grammar_point',
        key: 'lesson-7/tool-means',
        status: 'due',
        due_date: '2026-07-01',
        interval_days: 1,
        ease: 2,
        last_result: 'wrong'
      }
    ]
  })

  writeJson(path.join(studyRoot, 'state', 'current.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    current_lesson: 7,
    learning_mode: 'foundation_rebuild',
    active_goals: ['重建第 7 课输出', '回收薄弱点'],
    weakness_summary: [],
    recent_focus: {
      grammar: ['N で V'],
      listening: ['第 7 课听力'],
      speaking: ['受控短句输出']
    },
    next_recommendation: {
      date: '2026-07-01',
      plan_type: 'review_then_output',
      minutes: 40
    }
  })

  writeJson(path.join(studyRoot, 'index.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
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
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudy local loop verification', () => {
  it('walks the local save-submit-review-progress loop with manual override traceability', async () => {
    const studyRoot = createTempStudyRoot()
    seedLoopState(studyRoot)

    const nowValues = [
      '2026-07-01T09:10:00+08:00',
      '2026-07-01T09:20:00+08:00',
      '2026-07-01T09:30:00+08:00',
      '2026-07-01T09:31:00+08:00'
    ]
    let nowIndex = 0
    const now = () => nowValues[Math.min(nowIndex++, nowValues.length - 1)]

    const fileStore = createAgentStudyFileStore({ studyRoot, now })
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      now,
      createId: ({ actor, event, time }) =>
        `${actor}-${event}-${time.replace(/[^0-9]/g, '').slice(0, 14)}`
    })
    const workflow = createAgentStudyReviewWorkflow({ studyRoot, now })

    const latest = await handleGetLatestAgentStudy({ fileStore })
    expect(latest.dailyPacket.status).toBe('planned')
    expect(latest.reviewResult).toBeNull()

    const writablePacket = {
      ...latest.dailyPacket,
      status: 'answering',
      answers: {
        'ex-001': 'バスで いきます。',
        'ex-002': 'せんせいに しりょうを あげました。'
      },
      self_assessment: {
        difficulty: 'steady',
        uncertain_exercise_ids: ['ex-001'],
        confusing_points: ['de 和 ni 还是会混'],
        pace: 'steady',
        note: '想继续巩固手段助词。'
      }
    }

    const saved = await handleSaveDailyPacket({ dailyPacket: writablePacket }, { fileStore, eventLog })
    expect(saved.dailyPacket.status).toBe('answering')

    const submitted = await handleSubmitDailyPacket(
      { dailyPacket: saved.dailyPacket },
      { fileStore, eventLog }
    )
    expect(submitted.dailyPacket.status).toBe('submitted')

    const prompt = await handleGetPromptFile(
      { path: submitted.dailyPacket.correction.prompt_file },
      { fileStore }
    )
    expect(prompt.path).toBe('study/prompts/generated/2026-06-26-review.md')
    expect(prompt.content.length).toBeGreaterThan(0)

    const reviewResult = createSampleReviewResult({ date: '2026-06-26' })
    reviewResult.items[1].manual_override = {
      actor: 'human-reviewer',
      reason: 'Accepted concise but correct giving-direction sentence.',
      final_score: 0.82
    }
    reviewResult.items[1].score = 0.82
    reviewResult.items[1].confidence = 0.91
    reviewResult.items[1].retry_recommended = false

    const applied = workflow.applyReviewResult({
      dailyPacket: submitted.dailyPacket,
      reviewResult
    })
    expect(applied.dailyPacket.status).toBe('reviewed')
    expect(applied.reviewPath).toBe('study/reviews/2026-06-26-review.json')

    const progress = await handleGetAgentProgressReview({ fileStore, eventLog })
    const writtenReview = readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'))
    const writtenDaily = readJson(path.join(studyRoot, 'daily', '2026-06-26.json'))
    const writtenMastery = readJson(path.join(studyRoot, 'state', 'mastery.json'))
    const contextContent = fs.readFileSync(path.join(studyRoot, 'context', 'next-agent-context.md'), 'utf8')
    const eventRecords = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))

    expect(writtenDaily.correction.status).toBe('reviewed')
    expect(writtenDaily.correction.review_file).toBe('study/reviews/2026-06-26-review.json')
    expect(writtenReview.overall.accuracy).toBe(0.74)
    expect(writtenReview.items[1].manual_override.reason).toContain('Accepted concise but correct')
    expect(writtenMastery.grammar_points['lesson-7/tool-means'].status).toBe('weak')
    expect(progress.reviewResult?.id).toBe('review-2026-06-26')
    expect(progress.recentEvents.map((item) => item.event)).toEqual([
      'daily_saved',
      'daily_submitted',
      'review_applied'
    ])
    expect(contextContent).toContain('最新 review：study/reviews/2026-06-26-review.json')
    expect(eventRecords.map((item) => item.event)).toEqual([
      'daily_saved',
      'daily_submitted',
      'review_applied'
    ])
  })
})
