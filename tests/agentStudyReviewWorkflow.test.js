import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyReviewWorkflow } from '../src/server/agentStudy/reviewWorkflow.js'

const tempDirs = []
const repoRoot = process.cwd()

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-review-workflow-'))
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

const prepareSubmittedDaily = (studyRoot) => {
  const dailyPath = path.join(studyRoot, 'daily', '2026-06-26.json')
  const dailyPacket = readJson(dailyPath)
  dailyPacket.status = 'submitted'
  dailyPacket.revision = 1
  dailyPacket.updated_at = '2026-06-26T20:30:00+08:00'
  dailyPacket.correction.status = 'pending'
  dailyPacket.correction.review_file = ''
  dailyPacket.review_result = null
  writeJson(dailyPath, dailyPacket)
  return dailyPacket
}

const preparePreReviewMastery = (studyRoot) => {
  const masteryPath = path.join(studyRoot, 'state', 'mastery.json')
  const mastery = readJson(masteryPath)
  mastery.revision = 1
  mastery.updated_at = '2026-06-26T20:30:00+08:00'
  mastery.grammar_points['lesson-7/tool-means'].status = 'learning'
  mastery.grammar_points['lesson-7/tool-means'].controlled_output = 0.18
  writeJson(masteryPath, mastery)
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyReviewWorkflow', () => {
  it('applies a submitted review result and refreshes study state in order', () => {
    const studyRoot = createTempStudyRoot()
    const dailyPacket = prepareSubmittedDaily(studyRoot)
    preparePreReviewMastery(studyRoot)
    const startingCurrentRevision = readJson(path.join(studyRoot, 'state', 'current.json')).revision
    const startingReviewQueueRevision = readJson(path.join(studyRoot, 'state', 'review-queue.json')).revision
    const reviewResult = readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'))
    writeJson(path.join(studyRoot, 'index.json'), {
      ...readJson(path.join(studyRoot, 'index.json')),
      latest_review: null,
      revision: 1,
      updated_at: '2026-06-26T20:30:00+08:00'
    })
    fs.writeFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), '', 'utf8')

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
    const contextContent = fs.readFileSync(
      path.join(studyRoot, 'context', 'next-agent-context.md'),
      'utf8'
    )
    const eventLines = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
    const writtenReview = readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'))

    expect(result.reviewPath).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedDaily.status).toBe('reviewed')
    expect(updatedDaily.correction.status).toBe('reviewed')
    expect(updatedDaily.correction.review_file).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedDaily.review_result).toEqual({
      id: 'review-2026-06-26',
      accuracy: 0.74,
      summary:
        '第 7 课核心意思基本没问题，但交通方式里的「で」以及「もらう」短回复自然度还需要再过一轮。'
    })
    expect(updatedMastery.revision).toBe(2)
    expect(updatedMastery.grammar_points['lesson-7/tool-means'].status).toBe('weak')
    expect(updatedMastery.lesson_states['lesson-7'].last_reviewed_at).toBe('2026-06-26T21:00:00+08:00')
    expect(updatedReviewQueue.revision).toBe(startingReviewQueueRevision + 1)
    expect(updatedReviewQueue.items.find((item) => item.id === 'rq-lesson-7-tool-means')?.status).toBe('due')
    expect(updatedReviewQueue.items.find((item) => item.id === 'rq-lesson-7-ageru-morau')?.status).toBe('scheduled')
    expect(updatedCurrent.revision).toBe(startingCurrentRevision + 1)
    expect(updatedCurrent.learning_mode).toBe('foundation_rebuild')
    expect(updatedCurrent.next_recommendation.plan_type).toBe('review_then_output')
    expect(updatedCurrent.weakness_summary[0].key).toBe('ex-001')
    expect(updatedIndex.latest_review).toBe('study/reviews/2026-06-26-review.json')
    expect(updatedIndex.latest_daily).toBe('study/daily/2026-06-26.json')
    expect(updatedIndex.revision).toBe(2)
    expect(contextContent).toContain('最新 review：study/reviews/2026-06-26-review.json')
    expect(contextContent).toContain('study/state/review-queue.json')
    expect(eventLines).toHaveLength(1)
    expect(JSON.parse(eventLines[0]).event).toBe('review_applied')
    expect(writtenReview).toEqual(reviewResult)
  })

  it('does not update index when a later workflow step fails', () => {
    const studyRoot = createTempStudyRoot()
    const dailyPacket = prepareSubmittedDaily(studyRoot)
    preparePreReviewMastery(studyRoot)
    const reviewResult = readJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'))
    const originalIndex = {
      ...readJson(path.join(studyRoot, 'index.json')),
      latest_review: null,
      revision: 3,
      updated_at: '2026-06-26T20:30:00+08:00'
    }
    writeJson(path.join(studyRoot, 'index.json'), originalIndex)
    fs.writeFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), '', 'utf8')

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
