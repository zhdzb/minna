import { describe, expect, it } from 'vitest'
import { updateMasteryFromReview } from '../src/server/agentStudy/masteryUpdater'

const createMastery = () => ({
  schema_version: 1,
  revision: 3,
  updated_at: '2026-06-26T09:00:00+08:00',
  current_gate: 'lesson-7-foundation',
  lesson_states: {
    'lesson-7': {
      lesson: 7,
      status: 'learning',
      skill_scores: {
        grammar: 0.52,
        listening: 0.2,
        speaking: 0.28,
        reading: 0.34
      },
      last_reviewed_at: '2026-06-20T09:00:00+08:00'
    }
  },
  grammar_points: {
    'lesson-7/tool-means': {
      lesson: 7,
      pattern: 'N ? V',
      status: 'learning',
      recognition: 0.6,
      controlled_output: 0.58,
      free_output: 0.22,
      last_practiced_at: '2026-06-20T09:00:00+08:00'
    },
    'lesson-7/ageru': {
      lesson: 7,
      pattern: 'N1 ? N2 ? ????',
      status: 'learning',
      recognition: 0.45,
      controlled_output: 0.4,
      free_output: 0.24,
      last_practiced_at: '2026-06-20T09:00:00+08:00'
    }
  }
})

const createReviewResult = () => ({
  schema_version: 1,
  revision: 1,
  updated_at: '2026-06-26T21:00:00+08:00',
  id: 'review-2026-06-26',
  daily_id: 'daily-2026-06-26',
  created_at: '2026-06-26T21:00:00+08:00',
  overall: {
    accuracy: 0.74,
    can_advance: false,
    summary: 'Transport particle still needs work, but giving output is better.',
    next_focus: ['N ? V', 'ageru output']
  },
  items: [
    {
      exercise_id: 'ex-001',
      is_correct: false,
      score: 0.25,
      error_tags: ['particle', 'grammar_pattern'],
      target_grammar: 'N ? V',
      user_answer: '?',
      correct_answer: '?',
      explanation: 'This sentence needs the means particle.',
      retry_recommended: true,
      rubric: {
        target_particle: 0.0,
        pattern_match: 0.5,
        meaning: 0.7
      },
      confidence: 0.97,
      needs_user_input: false,
      acceptable_variants: [],
      manual_override: null
    },
    {
      exercise_id: 'ex-002',
      is_correct: true,
      score: 0.9,
      error_tags: [],
      target_grammar: 'N1 ? N2 ? ????',
      user_answer: 'watashi wa sensei ni hon o agemashita',
      correct_answer: 'watashi wa sensei ni hon o agemashita',
      explanation: 'The sentence uses the target grammar correctly.',
      retry_recommended: false,
      rubric: {
        meaning: 1.0,
        target_grammar: 0.9,
        particles: 0.9,
        naturalness: 0.8
      },
      confidence: 0.88,
      needs_user_input: false,
      acceptable_variants: [],
      manual_override: null
    }
  ],
  mastery_updates: [
    {
      scope: 'grammar_point',
      key: 'lesson-7/means-particle',
      from_status: 'learning',
      to_status: 'weak',
      evidence: ['ex-001 wrong particle']
    },
    {
      scope: 'grammar_point',
      key: 'lesson-7/ageru',
      from_status: 'learning',
      to_status: 'stabilizing',
      evidence: ['ex-002 correct output']
    }
  ],
  review_queue_updates: [],
  promotion_decision: {
    can_advance: false,
    reason: 'Lesson 7 still needs another correct cycle before promotion.'
  }
})

describe('updateMasteryFromReview', () => {
  it('updates grammar points and lesson skill scores from structured review evidence', () => {
    const mastery = createMastery()
    const reviewResult = createReviewResult()

    const updated = updateMasteryFromReview({
      mastery,
      reviewResult,
      now: () => '2026-06-26T22:15:00+08:00'
    })

    expect(updated.revision).toBe(4)
    expect(updated.updated_at).toBe('2026-06-26T22:15:00+08:00')
    expect(updated.grammar_points['lesson-7/tool-means'].status).toBe('weak')
    expect(updated.grammar_points['lesson-7/tool-means'].controlled_output).toBeLessThan(0.58)
    expect(updated.grammar_points['lesson-7/tool-means'].last_practiced_at).toBe('2026-06-26T21:00:00+08:00')
    expect(updated.grammar_points['lesson-7/ageru'].status).toBe('stabilizing')
    expect(updated.grammar_points['lesson-7/ageru'].controlled_output).toBeGreaterThan(0.4)
    expect(updated.lesson_states['lesson-7'].skill_scores.grammar).not.toBe(0.52)
    expect(updated.lesson_states['lesson-7'].skill_scores.speaking).toBeGreaterThan(0.28)
    expect(updated.lesson_states['lesson-7'].skill_scores.listening).toBe(0.2)
    expect(updated.lesson_states['lesson-7'].status).toBe('weak')
    expect(updated.lesson_states['lesson-7'].last_reviewed_at).toBe('2026-06-26T21:00:00+08:00')
  })

  it('rejects mastery updates that do not map to review evidence', () => {
    const mastery = createMastery()
    const reviewResult = createReviewResult()
    reviewResult.mastery_updates[0].evidence = ['missing-exercise-id']

    expect(() =>
      updateMasteryFromReview({
        mastery,
        reviewResult
      })
    ).toThrow(/no matching review item evidence/i)
  })

  it('does not promote a lesson to mastered when the review has no mastery evidence', () => {
    const mastery = createMastery()
    mastery.lesson_states['lesson-7'].status = 'stabilizing'
    const reviewResult = createReviewResult()
    reviewResult.mastery_updates = []
    reviewResult.promotion_decision.can_advance = true

    const updated = updateMasteryFromReview({
      mastery,
      reviewResult
    })

    expect(updated).toEqual(mastery)
    expect(updated.lesson_states['lesson-7'].status).toBe('stabilizing')
  })
})
