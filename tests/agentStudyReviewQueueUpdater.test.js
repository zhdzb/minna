import { describe, expect, it } from 'vitest'
import { updateReviewQueueFromReview } from '../src/server/agentStudy/reviewQueueUpdater'

const createReviewQueue = () => ({
  schema_version: 1,
  revision: 4,
  updated_at: '2026-06-26T09:00:00+08:00',
  items: [
    {
      id: 'rq-lesson-7-tool-means',
      kind: 'grammar_point',
      key: 'lesson-7/tool-means',
      status: 'scheduled',
      due_date: '2026-07-05',
      interval_days: 9,
      ease: 2.4,
      last_result: 'good'
    },
    {
      id: 'rq-lesson-7-ageru-morau',
      kind: 'grammar_point',
      key: 'lesson-7/ageru-morau',
      status: 'due',
      due_date: '2026-06-26',
      interval_days: 2,
      ease: 2.1,
      last_result: 'hard'
    },
    {
      id: 'rq-lesson-7-mastered-contrast',
      kind: 'grammar_point',
      key: 'lesson-7/mastered-contrast',
      status: 'scheduled',
      due_date: '2026-08-01',
      interval_days: 12,
      ease: 2.8,
      last_result: 'easy'
    }
  ]
})

const createReviewResult = (reviewQueueUpdates) => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-26T21:00:00+08:00',
  id: 'review-2026-06-26',
  daily_id: 'daily-2026-06-26',
  created_at: '2026-06-26T21:00:00+08:00',
  overall: {
    accuracy: 0.74,
    can_advance: false,
    summary: 'Review queue evidence only.',
    next_focus: ['lesson 7']
  },
  items: [],
  mastery_updates: [],
  review_queue_updates: reviewQueueUpdates,
  promotion_decision: {
    can_advance: false,
    reason: 'Not ready yet.'
  }
})

describe('updateReviewQueueFromReview', () => {
  it('resets wrong items to due with interval 1 and immediate re-entry', () => {
    const updated = updateReviewQueueFromReview({
      reviewQueue: createReviewQueue(),
      reviewResult: createReviewResult([
        {
          review_queue_id: 'rq-lesson-7-tool-means',
          action: 'due_soon',
          interval_days: 1,
          last_result: 'wrong'
        }
      ]),
      now: () => '2026-06-30T08:00:00+08:00'
    })

    const item = updated.items.find((entry) => entry.id === 'rq-lesson-7-tool-means')
    expect(updated.revision).toBe(5)
    expect(updated.updated_at).toBe('2026-06-30T08:00:00+08:00')
    expect(item.interval_days).toBe(1)
    expect(item.status).toBe('due')
    expect(item.due_date).toBe('2026-06-30')
    expect(item.last_result).toBe('wrong')
    expect(item.ease).toBeLessThan(2.4)
  })

  it('extends intervals for hard and good results using the simplified SRS rules', () => {
    const updated = updateReviewQueueFromReview({
      reviewQueue: createReviewQueue(),
      reviewResult: createReviewResult([
        {
          review_queue_id: 'rq-lesson-7-ageru-morau',
          action: 'keep_active',
          interval_days: 2,
          last_result: 'hard'
        },
        {
          review_queue_id: 'rq-lesson-7-tool-means',
          action: 'keep_active',
          interval_days: 8,
          last_result: 'good'
        }
      ]),
      now: () => '2026-06-30T08:00:00+08:00'
    })

    const hardItem = updated.items.find((entry) => entry.id === 'rq-lesson-7-ageru-morau')
    const goodItem = updated.items.find((entry) => entry.id === 'rq-lesson-7-tool-means')

    expect(hardItem.interval_days).toBe(2)
    expect(hardItem.status).toBe('scheduled')
    expect(hardItem.due_date).toBe('2026-07-02')
    expect(hardItem.ease).toBeLessThan(2.1)

    expect(goodItem.interval_days).toBe(18)
    expect(goodItem.status).toBe('scheduled')
    expect(goodItem.due_date).toBe('2026-07-18')
    expect(goodItem.ease).toBeGreaterThan(2.4)
  })

  it('keeps mastered content in long-term review and lets later wrong answers reactivate it', () => {
    const baseQueue = createReviewQueue()

    const longTermUpdated = updateReviewQueueFromReview({
      reviewQueue: baseQueue,
      reviewResult: createReviewResult([
        {
          review_queue_id: 'rq-lesson-7-mastered-contrast',
          action: 'keep_active',
          interval_days: 20,
          last_result: 'easy'
        }
      ]),
      now: () => '2026-06-30T08:00:00+08:00'
    })

    const masteredItem = longTermUpdated.items.find((entry) => entry.id === 'rq-lesson-7-mastered-contrast')
    expect(masteredItem.interval_days).toBe(36)
    expect(masteredItem.status).toBe('scheduled')
    expect(masteredItem.due_date).toBe('2026-08-05')

    const reactivated = updateReviewQueueFromReview({
      reviewQueue: longTermUpdated,
      reviewResult: createReviewResult([
        {
          review_queue_id: 'rq-lesson-7-mastered-contrast',
          action: 'due_soon',
          interval_days: 1,
          last_result: 'wrong'
        }
      ]),
      now: () => '2026-07-10T08:00:00+08:00'
    })

    const reactivatedItem = reactivated.items.find((entry) => entry.id === 'rq-lesson-7-mastered-contrast')
    expect(reactivatedItem.interval_days).toBe(1)
    expect(reactivatedItem.status).toBe('due')
    expect(reactivatedItem.due_date).toBe('2026-07-10')
  })

  it('rejects unsupported review queue updates', () => {
    expect(() =>
      updateReviewQueueFromReview({
        reviewQueue: createReviewQueue(),
        reviewResult: createReviewResult([
          {
            review_queue_id: 'rq-lesson-7-tool-means',
            action: 'keep_active',
            interval_days: 2,
            last_result: 'maybe'
          }
        ])
      })
    ).toThrow(/last_result must be one of/i)
  })
})
