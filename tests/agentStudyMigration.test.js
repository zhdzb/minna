import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  validateCurrent,
  validateMastery,
  validateReviewQueue
} from '../src/utils/agentStudySchema.js'
import {
  buildLegacyMistakeBuckets,
  migrateLegacyDataToStudyState,
  parseLegacyData
} from '../src/server/agentStudy/migrateLegacyData.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))

describe('agentStudy legacy migration', () => {
  it('parses legacy JSON text and groups repeat mistakes into stable buckets', () => {
    const legacyText = fs.readFileSync(path.join(repoRoot, 'data.json'), 'utf8')
    const legacyData = parseLegacyData(legacyText)
    const mistakeBuckets = buildLegacyMistakeBuckets(legacyData)

    expect(legacyData.progress.current_lesson).toBe(7)
    expect(mistakeBuckets[0]).toMatchObject({
      lesson: 1,
      grammar_point: 'q_translate',
      count: 9
    })
    expect(mistakeBuckets.some((bucket) => bucket.lesson === 17)).toBe(true)
  })

  it('migrates the current repo data.json into valid study state documents', () => {
    const migrated = migrateLegacyDataToStudyState({
      legacyData: readJson('data.json'),
      currentState: readJson('study/state/current.json'),
      masteryState: readJson('study/state/mastery.json'),
      reviewQueueState: readJson('study/state/review-queue.json'),
      now: () => '2026-06-30T10:00:00+08:00'
    })

    expect(validateCurrent(migrated.current).current_lesson).toBe(7)
    expect(migrated.current.active_goals).toEqual([
      '重建第 7 课输出能力',
      '回收历史错题复习队列'
    ])
    expect(migrated.current.weakness_summary[0].evidence).toContain('data.json:progress.lesson_stats.7')

    expect(validateMastery(migrated.mastery).lesson_states['lesson-7']).toMatchObject({
      lesson: 7,
      status: 'weak',
      last_reviewed_at: '2026-04-22T16:52:01.727Z'
    })
    expect(migrated.mastery.lesson_states['lesson-17'].status).toBe('weak')
    expect(migrated.mastery.grammar_points['lesson-7/tool-means']).toMatchObject({
      lesson: 7,
      pattern: 'N(工具/手段) で V (使用某种工具做某事)',
      status: 'weak'
    })
    expect(
      Object.values(migrated.mastery.grammar_points).some(
        (point) => point.lesson === 17 && point.pattern.includes('Vなければ なりません')
      )
    ).toBe(true)

    expect(validateReviewQueue(migrated.reviewQueue).items.length).toBeGreaterThanOrEqual(6)
    expect(migrated.reviewQueue.items.some((item) => item.id === 'rq-lesson-1-q-translate')).toBe(true)
    expect(migrated.reviewQueue.items.some((item) => item.id.includes('lesson-17'))).toBe(true)

    expect(migrated.report).toEqual({
      migrated_at: '2026-06-30T10:00:00+08:00',
      source_updated_at: '2026-05-28T11:19:44.738Z',
      current_lesson: 7,
      migrated_lesson_state_count: 13,
      migrated_pattern_count: 1,
      migrated_mistake_bucket_count: 5
    })
  })
})
