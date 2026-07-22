import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  validateAgentStudyDocument,
  validateCurrent,
  validateIndex,
  validateMastery,
  validateProfile,
  validatePromotionRules,
  validateDailyPacket,
  validateReviewDrill,
  validateReviewQueue,
  validateReviewResult
} from '../src/utils/agentStudySchema'
import {
  createSampleDailyPacket,
  createSampleReviewDrill,
  createSampleReviewResult
} from './helpers/agentStudyRuntimeFixtures'

const readStudyJson = (relativePath) => {
  const fullPath = path.resolve(process.cwd(), relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

describe('agentStudySchema', () => {
  it('validates seeded study JSON files', () => {
    const indexDocument = validateIndex(readStudyJson('study/index.json'))

    expect(indexDocument.latest_daily).toBe('study/daily/2026-07-21.json')
    expect(indexDocument.latest_prompt).toBe('study/prompts/generated/2026-07-21-review.md')
    expect(indexDocument.latest_review).toBe('study/reviews/2026-07-21-review.json')
    expect(validateDailyPacket(readStudyJson(indexDocument.latest_daily)).id).toBe('daily-2026-07-21')
    expect(validateReviewResult(readStudyJson(indexDocument.latest_review)).id).toBe('review-2026-07-21')
    expect(validateProfile(readStudyJson('study/state/profile.json')).material_scope.current_focus_lessons).toEqual([6, 7, 8, 9, 10])
    expect(validateCurrent(readStudyJson('study/state/current.json')).current_lesson).toBe(6)
    expect(validateMastery(readStudyJson('study/state/mastery.json')).current_gate).toBe('lesson-6-foundation')
    expect(validateReviewQueue(readStudyJson('study/state/review-queue.json')).items).toHaveLength(4)
    expect(validatePromotionRules(readStudyJson('study/state/promotion-rules.json')).lesson_gate.min_recent_sessions).toBe(2)
  })

  it('validates representative runtime documents from fixtures', () => {
    expect(createSampleDailyPacket().mission.focus_lessons).toEqual([7])
    expect(validateReviewResult(createSampleReviewResult()).daily_id).toBe('daily-2026-06-26')
    expect(validateReviewDrill(createSampleReviewDrill()).items).toHaveLength(1)
  })

  it('preserves dictionary-form feedback for vocabulary errors', () => {
    const reviewResult = createSampleReviewResult()
    reviewResult.items[0].error_tags.push('vocabulary')
    reviewResult.items[0].vocabulary_feedback = [
      { dictionary_form: 'のむ', meaning: '喝' }
    ]

    expect(validateReviewResult(reviewResult).items[0].vocabulary_feedback).toEqual([
      { dictionary_form: 'のむ', meaning: '喝' }
    ])
  })

  it('dispatches through the generic validator', () => {
    const indexDocument = readStudyJson('study/index.json')
    expect(validateAgentStudyDocument('index', indexDocument).schema_version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('rejects missing revision and missing required fields with clear errors', () => {
    const profile = readStudyJson('study/state/profile.json')
    delete profile.revision
    expect(() => validateProfile(profile)).toThrow(/profile.revision/)

    const current = readStudyJson('study/state/current.json')
    delete current.current_lesson
    expect(() => validateCurrent(current)).toThrow(/current.current_lesson/)
  })

  it('rejects unsupported schema versions', () => {
    const indexDocument = readStudyJson('study/index.json')
    indexDocument.schema_version = 99
    expect(() => validateIndex(indexDocument)).toThrow(/schema_version 99/)
  })

  it('normalizes a supported legacy profile fixture to the current version', () => {
    const legacyProfile = {
      schema_version: 0,
      revision: 1,
      updated_at: '2026-06-01T00:00:00+08:00',
      learner_id: 'legacy-user',
      goals: ['rebuild lesson 7'],
      time_budget_minutes: 45,
      pace_preference: 'steady',
      input_preferences: {
        allow_romaji: false,
        prefer_kana_first: true,
        practice_kanji: false,
        ui_language: 'zh-CN'
      },
      series: 'Minna no Nihongo',
      focus_lessons: [7],
      allow_new_lessons: false,
      notes: ['legacy fixture']
    }

    const normalized = validateProfile(legacyProfile)
    expect(normalized.schema_version).toBe(1)
    expect(normalized.daily_time_budget_minutes).toBe(45)
    expect(normalized.material_scope.series).toBe('Minna no Nihongo')
    expect(normalized.material_scope.current_focus_lessons).toEqual([7])
  })
})
