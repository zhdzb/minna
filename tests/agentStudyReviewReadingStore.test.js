import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createReviewReadingStore } from '../src/server/agentStudy/reviewReadingStore.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-review-reading-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
  return studyRoot
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
})

describe('reviewReadingStore', () => {
  it('stores reading status and cursor independently for each review', () => {
    const studyRoot = createTempStudyRoot()
    let timestamp = '2026-08-26T10:00:00+08:00'
    const store = createReviewReadingStore({ studyRoot, now: () => timestamp })

    expect(store.load().reviews).toEqual({})
    timestamp = '2026-08-26T10:01:00+08:00'
    store.updateItem({
      reviewId: 'review-1',
      reviewFile: 'study/reviews/review-1.json',
      exerciseId: 'ex-01',
      status: 'read'
    })
    timestamp = '2026-08-26T10:02:00+08:00'
    const result = store.updateItem({
      reviewId: 'review-1',
      reviewFile: 'study/reviews/review-1.json',
      exerciseId: 'ex-05'
    })

    expect(result.reviews['review-1']).toMatchObject({
      review_file: 'study/reviews/review-1.json',
      last_exercise_id: 'ex-05',
      items: {
        'ex-01': {
          status: 'read',
          updated_at: '2026-08-26T10:01:00+08:00'
        }
      }
    })
    expect(result.revision).toBe(3)
  })
})
