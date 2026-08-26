import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMistakeDrillSessionStore } from '../src/server/agentStudy/mistakeDrillSessionStore.js'
import { createSampleDailyPacket, createSampleReviewResult } from './helpers/agentStudyRuntimeFixtures.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-mistake-session-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
  return studyRoot
}

const createMistake = (id, createdAt, lastPracticedAt = null) => {
  const daily = createSampleDailyPacket()
  const review = createSampleReviewResult()
  return {
    id,
    status: 'active',
    created_at: createdAt,
    source_daily: 'study/daily/2026-06-26.json',
    source_review: 'study/reviews/2026-06-26-review.json',
    daily_id: daily.id,
    review_id: review.id,
    exercise_id: daily.exercises[0].id + '-' + id,
    lesson: daily.exercises[0].lesson,
    target_grammar: daily.exercises[0].target_grammar,
    source_types: ['automatic'],
    exercise_snapshot: { ...daily.exercises[0], id: daily.exercises[0].id + '-' + id },
    review_snapshot: { ...review.items[0], exercise_id: daily.exercises[0].id + '-' + id },
    attempts: [],
    last_practiced_at: lastPracticedAt
  }
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
})

describe('mistakeDrillSessionStore', () => {
  it('starts a small session, persists progress, and completes it', () => {
    const studyRoot = createTempStudyRoot()
    let timestamp = '2026-08-26T11:00:00+08:00'
    const store = createMistakeDrillSessionStore({ studyRoot, now: () => timestamp })
    const mistakeBook = {
      schema_version: 1,
      revision: 1,
      updated_at: timestamp,
      items: [
        createMistake('mistake-1', '2026-08-20T10:00:00+08:00'),
        createMistake('mistake-2', '2026-08-21T10:00:00+08:00'),
        createMistake('mistake-3', '2026-08-22T10:00:00+08:00'),
        createMistake('mistake-4', '2026-08-23T10:00:00+08:00')
      ]
    }

    const started = store.start({ mistakeBook, size: 3 })
    expect(started.status).toBe('active')
    expect(started.mistake_ids).toEqual(['mistake-1', 'mistake-2', 'mistake-3'])

    timestamp = '2026-08-26T11:05:00+08:00'
    const afterFirst = store.advance({ mistakeId: 'mistake-1' })
    expect(afterFirst.current_index).toBe(1)
    expect(store.load().submitted_ids).toEqual(['mistake-1'])

    store.advance({ mistakeId: 'mistake-2' })
    const completed = store.advance({ mistakeId: 'mistake-3' })
    expect(completed.status).toBe('completed')
    expect(completed.current_index).toBe(3)
    expect(completed.completed_at).toBe(timestamp)
  })

  it('limits an explicitly selected session to active mistakes', () => {
    const studyRoot = createTempStudyRoot()
    const timestamp = '2026-08-26T11:00:00+08:00'
    const store = createMistakeDrillSessionStore({ studyRoot, now: () => timestamp })
    const active = createMistake('active', timestamp)
    const dismissed = { ...createMistake('dismissed', timestamp), status: 'dismissed' }
    const mistakeBook = {
      schema_version: 1,
      revision: 1,
      updated_at: timestamp,
      items: [active, dismissed]
    }

    expect(store.start({ mistakeBook, size: 5, mistakeIds: ['active', 'dismissed'] }).mistake_ids)
      .toEqual(['active'])
  })
})
