import { describe, expect, it } from 'vitest'
import { buildDailyPlanRules, MINUTES_PRESETS, PLAN_TYPES } from '../src/utils/planRules'

describe('planRules', () => {
  it('supports the expected minute presets', () => {
    expect(MINUTES_PRESETS).toEqual([30, 60, 90, 120])
  })

  it('creates a foundation review plan for short foundation rebuild sessions', () => {
    const plan = buildDailyPlanRules({
      availableMinutes: 30,
      currentLesson: 6,
      foundationRestartEnabled: true,
      recentMistakeCount: 1
    })

    expect(plan.available_minutes).toBe(30)
    expect(plan.plan_type).toBe(PLAN_TYPES.FOUNDATION_REVIEW)
    expect(plan.focus_lessons).toEqual([6])
    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.tasks.every((task) => task.required)).toBe(true)
  })

  it('creates a new lesson plan when foundation rebuild is disabled', () => {
    const plan = buildDailyPlanRules({
      availableMinutes: 60,
      currentLesson: 12,
      foundationRestartEnabled: false,
      recentMistakeCount: 1
    })

    expect(plan.available_minutes).toBe(60)
    expect(plan.plan_type).toBe(PLAN_TYPES.NEW_LESSON)
    expect(plan.focus_lessons).toEqual([12])
  })

  it('creates a listening and speaking plan for longer priority sessions', () => {
    const plan = buildDailyPlanRules({
      availableMinutes: 90,
      currentLesson: 18,
      foundationRestartEnabled: false,
      prioritizeListeningSpeaking: true,
      recentMistakeCount: 0
    })

    expect(plan.available_minutes).toBe(90)
    expect(plan.plan_type).toBe(PLAN_TYPES.LISTENING_SPEAKING)
    expect(plan.tasks.some((task) => task.type === 'scenario_speaking')).toBe(true)
    expect(plan.tasks.some((task) => task.type === 'listening_drill')).toBe(true)
  })

  it('creates a weekend long session for long weekend plans', () => {
    const plan = buildDailyPlanRules({
      availableMinutes: 120,
      currentLesson: 22,
      isWeekend: true,
      recentMistakeCount: 0
    })

    expect(plan.available_minutes).toBe(120)
    expect(plan.plan_type).toBe(PLAN_TYPES.WEEKEND_LONG_SESSION)
    expect(plan.focus_lessons).toEqual([22, 21])
    expect(plan.optional_tasks).toHaveLength(1)
  })

  it('creates a mistake review plan when recent mistake pressure is high', () => {
    const plan = buildDailyPlanRules({
      availableMinutes: 60,
      currentLesson: 9,
      recentMistakeCount: 6,
      foundationRestartEnabled: true
    })

    expect(plan.plan_type).toBe(PLAN_TYPES.MISTAKE_REVIEW)
    expect(plan.tasks[0].type).toBe('mistake_review')
  })
})
