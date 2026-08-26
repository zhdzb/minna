import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyMistakeStore } from '../src/server/agentStudy/mistakeStore.js'
import {
  createSampleDailyPacket,
  createSampleReviewResult
} from './helpers/agentStudyRuntimeFixtures.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-mistakes-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyMistakeStore', () => {
  it('rebuilds false review items with exercise and evaluation snapshots', () => {
    const studyRoot = createTempStudyRoot()
    const dailyPacket = createSampleDailyPacket({ status: 'reviewed' })
    const reviewResult = createSampleReviewResult()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), dailyPacket)
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), reviewResult)

    const store = createAgentStudyMistakeStore({
      studyRoot,
      now: () => '2026-07-23T09:00:00+08:00'
    })
    const mistakeBook = store.loadMistakeBook()

    expect(mistakeBook.items).toHaveLength(1)
    expect(mistakeBook.items[0]).toMatchObject({
      id: 'mistake:review-2026-06-26:ex-001',
      source_daily: 'study/daily/2026-06-26.json',
      source_review: 'study/reviews/2026-06-26-review.json',
      exercise_id: 'ex-001',
      attempts: []
    })
    expect(mistakeBook.items[0].exercise_snapshot.prompt).toBe(
      dailyPacket.exercises[0].prompt
    )
    expect(mistakeBook.items[0].review_snapshot.explanation).toBe(
      reviewResult.items[0].explanation
    )
    expect(mistakeBook.items[0].review_snapshot.is_correct).toBe(false)

    const laterDaily = createSampleDailyPacket({
      date: '2026-07-23',
      status: 'reviewed'
    })
    const laterReview = createSampleReviewResult({ date: '2026-07-23' })
    writeJson(path.join(studyRoot, 'daily', '2026-07-23.json'), laterDaily)
    writeJson(path.join(studyRoot, 'reviews', '2026-07-23-review.json'), laterReview)

    expect(store.loadMistakeBook().items).toHaveLength(2)
  })

  it('is idempotent for the same review and records repeated attempts', () => {
    const studyRoot = createTempStudyRoot()
    const dailyPacket = createSampleDailyPacket({ status: 'reviewed' })
    const reviewResult = createSampleReviewResult()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), dailyPacket)
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), reviewResult)

    let timestamp = '2026-07-23T09:00:00+08:00'
    const store = createAgentStudyMistakeStore({
      studyRoot,
      now: () => timestamp
    })
    store.loadMistakeBook()

    const synced = store.syncFromReview({
      dailyPacket,
      dailyPath: 'study/daily/2026-06-26.json',
      reviewResult,
      reviewPath: 'study/reviews/2026-06-26-review.json'
    })
    expect(synced.items).toHaveLength(1)

    timestamp = '2026-07-23T09:10:00+08:00'
    store.recordAttempt({
      mistakeId: synced.items[0].id,
      answer: 'バスで いきます。'
    })
    timestamp = '2026-07-23T09:20:00+08:00'
    const result = store.recordAttempt({
      mistakeId: synced.items[0].id,
      answer: 'バスで 行きます。'
    })

    expect(result.mistake.attempts).toHaveLength(2)
    expect(result.mistake.attempts.map((attempt) => attempt.answer)).toEqual([
      'バスで いきます。',
      'バスで 行きます。'
    ])
    expect(result.mistake.last_practiced_at).toBe('2026-07-23T09:20:00+08:00')

    timestamp = '2026-07-23T09:30:00+08:00'
    const dismissed = store.dismissMistake({ mistakeId: synced.items[0].id })
    expect(dismissed.mistake.status).toBe('dismissed')
    expect(store.loadMistakeBook().items[0].status).toBe('dismissed')
  })

  it('merges manual and automatic sources and supports reversible status changes', () => {
    const studyRoot = createTempStudyRoot()
    const dailyPacket = createSampleDailyPacket({ status: 'reviewed' })
    const reviewResult = createSampleReviewResult()
    writeJson(path.join(studyRoot, 'daily', '2026-06-26.json'), dailyPacket)
    writeJson(path.join(studyRoot, 'reviews', '2026-06-26-review.json'), reviewResult)

    const store = createAgentStudyMistakeStore({
      studyRoot,
      now: () => '2026-08-26T12:00:00+08:00'
    })
    const automatic = store.loadMistakeBook().items[0]
    const merged = store.addManualMistake({
      dailyPacket,
      dailyPath: 'study/daily/2026-06-26.json',
      exerciseId: automatic.exercise_id,
      reviewResult,
      reviewPath: 'study/reviews/2026-06-26-review.json'
    })

    expect(merged.mistakeBook.items).toHaveLength(1)
    expect(merged.mistake.source_types).toEqual(['automatic', 'manual'])

    const correctManual = store.addManualMistake({
      dailyPacket,
      dailyPath: 'study/daily/2026-06-26.json',
      exerciseId: 'ex-002',
      reviewResult,
      reviewPath: 'study/reviews/2026-06-26-review.json'
    })
    expect(correctManual.mistake.review_snapshot.is_correct).toBe(true)
    expect(correctManual.mistake.source_types).toEqual(['manual'])

    const mastered = store.setMistakeStatus({
      mistakeId: correctManual.mistake.id,
      status: 'mastered'
    })
    expect(mastered.mistake.status).toBe('mastered')
    const dismissed = store.setMistakeStatuses({
      mistakeIds: mastered.mistakeBook.items.map((item) => item.id),
      status: 'dismissed'
    })
    expect(dismissed.mistakes.every((item) => item.status === 'dismissed')).toBe(true)
    const restored = store.setMistakeStatus({
      mistakeId: correctManual.mistake.id,
      status: 'active'
    })
    expect(restored.mistake.status).toBe('active')
  })
})
