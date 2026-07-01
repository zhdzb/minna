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

const repoRoot = process.cwd()
const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-local-loop-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.cpSync(path.join(repoRoot, 'study'), studyRoot, { recursive: true })
  return studyRoot
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const resetSeedStudyForLoop = (studyRoot) => {
  const dailyPath = path.join(studyRoot, 'daily', '2026-06-26.json')
  const masteryPath = path.join(studyRoot, 'state', 'mastery.json')
  const queuePath = path.join(studyRoot, 'state', 'review-queue.json')
  const currentPath = path.join(studyRoot, 'state', 'current.json')
  const indexPath = path.join(studyRoot, 'index.json')
  const logPath = path.join(studyRoot, 'logs', 'agent-events.jsonl')

  const daily = readJson(dailyPath)
  daily.status = 'planned'
  daily.correction = {
    ...daily.correction,
    status: 'pending',
    review_file: ''
  }
  daily.review_result = null
  daily.answers = {
    'ex-001': '',
    'ex-002': '',
    'ex-003': ''
  }
  daily.self_assessment = {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: '',
    note: ''
  }
  daily.revision = 2
  daily.updated_at = '2026-07-01T09:00:00+08:00'
  writeJson(dailyPath, daily)

  const mastery = readJson(masteryPath)
  mastery.revision = 2
  mastery.updated_at = '2026-07-01T09:00:00+08:00'
  mastery.lesson_states['lesson-7'].status = 'learning'
  mastery.lesson_states['lesson-7'].skill_scores = {
    grammar: 0.52,
    listening: 0.2,
    speaking: 0.28,
    reading: 0.34
  }
  mastery.grammar_points['lesson-7/tool-means'].status = 'learning'
  mastery.grammar_points['lesson-7/tool-means'].recognition = 0.6
  mastery.grammar_points['lesson-7/tool-means'].controlled_output = 0.18
  mastery.grammar_points['lesson-7/tool-means'].free_output = 0.12
  mastery.grammar_points['lesson-7/ageru'].status = 'learning'
  mastery.grammar_points['lesson-7/ageru'].recognition = 0.45
  mastery.grammar_points['lesson-7/ageru'].controlled_output = 0.4
  mastery.grammar_points['lesson-7/ageru'].free_output = 0.24
  mastery.grammar_points['lesson-7/morau'].status = 'learning'
  mastery.grammar_points['lesson-7/morau'].recognition = 0.4
  mastery.grammar_points['lesson-7/morau'].controlled_output = 0.22
  mastery.grammar_points['lesson-7/morau'].free_output = 0.26
  writeJson(masteryPath, mastery)

  const queue = readJson(queuePath)
  queue.revision = 2
  queue.updated_at = '2026-07-01T09:00:00+08:00'
  const morauQueue = queue.items.find((item) => item.id === 'rq-lesson-7-ageru-morau')
  if (morauQueue) {
    morauQueue.status = 'due'
    morauQueue.due_date = '2026-07-01'
    morauQueue.interval_days = 1
    morauQueue.last_result = 'hard'
  }
  writeJson(queuePath, queue)

  const current = readJson(currentPath)
  current.revision = 2
  current.updated_at = '2026-07-01T09:00:00+08:00'
  current.learning_mode = 'foundation_rebuild'
  writeJson(currentPath, current)

  const index = readJson(indexPath)
  index.revision = 2
  index.updated_at = '2026-07-01T09:00:00+08:00'
  index.latest_daily = 'study/daily/2026-06-26.json'
  index.latest_review = null
  index.latest_prompt = 'study/prompts/generated/2026-06-26-review.md'
  writeJson(indexPath, index)

  fs.writeFileSync(logPath, '', 'utf8')
}

const buildReviewResultWithManualOverride = () => {
  const reviewResult = readJson(path.join(repoRoot, 'study', 'reviews', '2026-06-26-review.json'))
  reviewResult.revision = 2
  reviewResult.updated_at = '2026-07-01T09:30:00+08:00'
  reviewResult.created_at = '2026-07-01T09:30:00+08:00'
  reviewResult.overall.accuracy = 0.79
  reviewResult.overall.summary =
    'Manual override accepted the concise moraimasu reply, but the means particle still needs another cycle.'
  reviewResult.overall.next_focus = [
    'N de V transport sentences',
    'Fuller moraimasu conversation replies'
  ]
  reviewResult.items = reviewResult.items.map((item) => {
    if (item.exercise_id !== 'ex-003') {
      return item
    }

    return {
      ...item,
      score: 0.82,
      confidence: 0.91,
      retry_recommended: false,
      needs_user_input: false,
      explanation:
        'A human reviewer accepted the concise reply after checking that the ownership direction and core meaning were correct.',
      rubric: {
        ...item.rubric,
        naturalness: 0.8,
        context_match: 0.85,
        politeness: 0.8,
        intent: 0.82
      },
      manual_override: {
        actor: 'human-reviewer',
        reason: 'Accepted concise but correct moraimasu reply after manual check.',
        original_score: item.score,
        final_score: 0.82
      }
    }
  })
  reviewResult.mastery_updates = [
    {
      scope: 'grammar_point',
      key: 'lesson-7/means-particle',
      from_status: 'learning',
      to_status: 'weak',
      evidence: ['ex-001 wrong particle even after review']
    },
    {
      scope: 'grammar_point',
      key: 'lesson-7/ageru',
      from_status: 'learning',
      to_status: 'stabilizing',
      evidence: ['ex-002 correct giving direction']
    },
    {
      scope: 'grammar_point',
      key: 'lesson-7/morau',
      from_status: 'learning',
      to_status: 'stabilizing',
      evidence: ['ex-003 accepted via manual override after concise but correct reply']
    }
  ]
  reviewResult.review_queue_updates = [
    {
      review_queue_id: 'rq-lesson-7-tool-means',
      action: 'due_soon',
      interval_days: 1,
      last_result: 'wrong'
    },
    {
      review_queue_id: 'rq-lesson-7-ageru-morau',
      action: 'keep_active',
      interval_days: 3,
      last_result: 'good'
    }
  ]
  reviewResult.promotion_decision = {
    can_advance: false,
    reason: 'Override recovered the moraimasu reply, but the means particle still blocks promotion.'
  }

  return reviewResult
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudy local loop verification', () => {
  it('walks the local save-submit-review-progress loop with manual override traceability', async () => {
    const studyRoot = createTempStudyRoot()
    resetSeedStudyForLoop(studyRoot)

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
        'ex-001': 'de',
        'ex-002': 'watashi wa sensei ni hon o agemashita',
        'ex-003': 'tomodachi ni hon o moraimashita'
      },
      self_assessment: {
        difficulty: 'steady',
        uncertain_exercise_ids: ['ex-001', 'ex-003'],
        confusing_points: ['Still mixing up de and ni in transport sentences'],
        pace: 'steady',
        note: 'Need one more pass on moraimasu conversation replies.'
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

    const reviewResult = buildReviewResultWithManualOverride()
    reviewResult.daily_id = submitted.dailyPacket.id

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
    const writtenQueue = readJson(path.join(studyRoot, 'state', 'review-queue.json'))
    const contextContent = fs.readFileSync(
      path.join(studyRoot, 'context', 'next-agent-context.md'),
      'utf8'
    )
    const eventRecords = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))

    expect(writtenDaily.correction.status).toBe('reviewed')
    expect(writtenDaily.correction.review_file).toBe('study/reviews/2026-06-26-review.json')
    expect(writtenReview.overall.accuracy).toBe(0.79)
    expect(
      writtenReview.items.find((item) => item.exercise_id === 'ex-003')?.manual_override?.reason
    ).toContain('Accepted concise but correct moraimasu reply')
    expect(writtenMastery.grammar_points['lesson-7/morau'].status).toBe('stabilizing')
    expect(writtenMastery.lesson_states['lesson-7'].status).toBe('weak')
    expect(writtenQueue.items.find((item) => item.id === 'rq-lesson-7-ageru-morau')?.status).toBe(
      'scheduled'
    )
    expect(progress.reviewResult?.id).toBe('review-2026-06-26')
    expect(progress.recentEvents.map((item) => item.event)).toEqual([
      'daily_saved',
      'daily_submitted',
      'review_applied'
    ])
    expect(eventRecords.map((item) => item.event)).toEqual([
      'daily_saved',
      'daily_submitted',
      'review_applied'
    ])
    expect(
      eventRecords.find((item) => item.event === 'review_applied')?.output_files || []
    ).toContain('study/reviews/2026-06-26-review.json')
    expect(contextContent).toContain('Latest review: study/reviews/2026-06-26-review.json')
    expect(contextContent).toContain('study/state/review-queue.json')
  })
})
