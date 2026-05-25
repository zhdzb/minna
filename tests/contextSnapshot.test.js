import { describe, expect, it } from 'vitest'
import { createContextSnapshot } from '../src/server/contextSnapshot'

describe('contextSnapshot', () => {
  it('builds a sanitized context snapshot from learning state', () => {
    const snapshot = createContextSnapshot({
      current_stage: 'foundation_rebuild',
      target_exam: 'N3',
      priority_skills: ['listening', '', 'speaking'],
      current_lesson: '22',
      active_review_lessons: ['5', 'bad', 6],
      recent_weak_patterns: ['〜へ いきます', null, '〜て ください'],
      last_7_days_summary: {
        planned_minutes: '320',
        completed_minutes: '210',
        missed_tasks: '4'
      },
      provider: 'gemini',
      prompt_version: 'plan-v1',
      apiKey: 'secret',
      openaiApiKey: 'another-secret'
    })

    expect(snapshot).toEqual({
      current_stage: 'foundation_rebuild',
      target_exam: 'N3',
      priority_skills: ['listening', 'speaking'],
      current_lesson: 22,
      active_review_lessons: [5, 6],
      recent_weak_patterns: ['〜へ いきます', '〜て ください'],
      last_7_days_summary: {
        planned_minutes: 320,
        completed_minutes: 210,
        missed_tasks: 4
      },
      provider: 'gemini',
      prompt_version: 'plan-v1'
    })
  })

  it('falls back to safe defaults when values are missing', () => {
    expect(createContextSnapshot()).toEqual({
      current_stage: '',
      target_exam: '',
      priority_skills: [],
      current_lesson: 1,
      active_review_lessons: [],
      recent_weak_patterns: [],
      last_7_days_summary: {
        planned_minutes: 0,
        completed_minutes: 0,
        missed_tasks: 0
      },
      provider: '',
      prompt_version: ''
    })
  })
})
