import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  validateAgentStudyDocument,
  validateCurrent,
  validateDailyPacket,
  validateIndex,
  validateMastery,
  validateProfile,
  validatePromotionRules,
  validateReviewDrill,
  validateReviewQueue,
  validateReviewResult
} from '../src/utils/agentStudySchema'

const readStudyJson = (relativePath) => {
  const fullPath = path.resolve(process.cwd(), relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

describe('agentStudySchema', () => {
  it('validates all seed study JSON files', () => {
    expect(validateIndex(readStudyJson('study/index.json')).latest_daily).toBe('study/daily/2026-06-26.json')
    expect(validateProfile(readStudyJson('study/state/profile.json')).material_scope.current_focus_lessons).toEqual([7])
    expect(validateCurrent(readStudyJson('study/state/current.json')).current_lesson).toBe(7)
    expect(validateMastery(readStudyJson('study/state/mastery.json')).current_gate).toBe('lesson-7-foundation')
    expect(validateReviewQueue(readStudyJson('study/state/review-queue.json')).items).toHaveLength(7)
    expect(validatePromotionRules(readStudyJson('study/state/promotion-rules.json')).lesson_gate.min_recent_sessions).toBe(2)
    expect(validateDailyPacket(readStudyJson('study/daily/2026-06-26.json')).mission.focus_lessons).toEqual([7])
    expect(validateReviewResult(readStudyJson('study/reviews/2026-06-26-review.json')).daily_id).toBe('daily-2026-06-26')
    expect(validateReviewDrill(readStudyJson('study/review-drills/2026-06-30.json')).items).toHaveLength(2)
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

  it('validates review results with confidence metadata', () => {
    const reviewResult = {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-26T10:00:00+08:00',
      id: 'review-2026-06-26',
      daily_id: 'daily-2026-06-26',
      created_at: '2026-06-26T10:00:00+08:00',
      overall: {
        accuracy: 0.75,
        can_advance: false,
        summary: 'Needs more controlled output practice.',
        next_focus: ['N ? V', 'giving and receiving verbs']
      },
      items: [
        {
          exercise_id: 'ex-001',
          is_correct: false,
          score: 0.4,
          error_tags: ['particle'],
          target_grammar: 'N ? V',
          user_answer: '?',
          correct_answer: '?',
          explanation: 'The sentence needs the means particle.',
          retry_recommended: true,
          rubric: {
            grammar: 0.4,
            particles: 0.2,
            naturalness: 0.6
          },
          confidence: 0.82,
          needs_user_input: false,
          acceptable_variants: ['?'],
          manual_override: null
        }
      ],
      mastery_updates: [],
      review_queue_updates: [],
      promotion_decision: {
        can_advance: false,
        reason: 'Accuracy is below the output threshold.'
      }
    }

    expect(validateReviewResult(reviewResult).items[0].confidence).toBe(0.82)
    expect(validateReviewResult(reviewResult).items[0].rubric.grammar).toBe(0.4)
  })

  it('validates review drills with structured weakness explanations and answers', () => {
    const reviewDrill = {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T09:00:00+08:00',
      id: 'review-drill-2026-06-30',
      date: '2026-06-30',
      status: 'draft',
      created_at: '2026-06-30T09:00:00+08:00',
      source_review: 'study/reviews/2026-06-26-review.json',
      summary: {
        title: 'Lesson 7 weak points refresh',
        focus: ['means particle', 'morau reply shape'],
        due_review_queue_ids: ['rq-lesson-7-tool-means', 'rq-lesson-7-ageru-morau']
      },
      items: [
        {
          id: 'drill-001',
          review_queue_id: 'rq-lesson-7-tool-means',
          key: 'lesson-7/tool-means',
          lesson: 7,
          target_grammar: 'N de V',
          weakness_explanation: 'The means particle still collapses under output pressure.',
          error_tags: ['particle'],
          original_prompt: 'Translate: I go by bus.',
          variant_prompt: 'Say: I go to the station by taxi today.',
          answer_reference: 'Kyou wa takushii de eki ni ikimasu.',
          user_answer: '',
          hint: 'Keep the transport phrase attached to de.',
          status: 'pending'
        }
      ],
      submission: {
        submitted_at: null,
        note: ''
      }
    }

    expect(validateReviewDrill(reviewDrill).items[0].review_queue_id).toBe('rq-lesson-7-tool-means')
  })
})
