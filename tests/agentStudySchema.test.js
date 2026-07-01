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
  it('validates reset seed study JSON files', () => {
    expect(validateIndex(readStudyJson('study/index.json')).latest_daily).toBeNull()
    expect(validateProfile(readStudyJson('study/state/profile.json')).material_scope.current_focus_lessons).toEqual([1])
    expect(validateCurrent(readStudyJson('study/state/current.json')).current_lesson).toBe(1)
    expect(validateMastery(readStudyJson('study/state/mastery.json')).current_gate).toBe('lesson-1-foundation')
    expect(validateReviewQueue(readStudyJson('study/state/review-queue.json')).items).toHaveLength(0)
    expect(validatePromotionRules(readStudyJson('study/state/promotion-rules.json')).lesson_gate.min_recent_sessions).toBe(2)
  })

  it('validates representative runtime documents from fixtures', () => {
    expect(createSampleDailyPacket().mission.focus_lessons).toEqual([7])
    expect(validateReviewResult(createSampleReviewResult()).daily_id).toBe('daily-2026-06-26')
    expect(validateReviewDrill(createSampleReviewDrill()).items).toHaveLength(1)
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
