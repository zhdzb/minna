import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { normalizeData, useMainStore } from '../src/store/mainStore'

describe('mainStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }))
  })

  it('initializes with the new default shape', () => {
    const store = useMainStore()

    expect(store.progress.current_lesson).toBe(1)
    expect(store.daily_plan).toEqual({
      date: null,
      available_minutes: null,
      plan_type: '',
      focus_lessons: [],
      tasks: [],
      completion_criteria: [],
      ai_summary: '',
      status: 'idle',
      created_at: null,
      completed_at: null
    })
    expect(store.lesson_mastery).toEqual({})
    expect(store.pattern_mastery).toEqual({})
    expect(store.mistakes_book).toEqual([])
    expect(store.study_backups).toEqual([])
  })

  it('normalizes partial daily plan payloads without breaking existing users', () => {
    const normalized = normalizeData({
      progress: { current_lesson: 4 },
      daily_plan: {
        date: '2026-05-25',
        available_minutes: '60',
        focus_lessons: ['5', 'bad', 6],
        tasks: [
          {
            title: 'Review lesson 5',
            minutes: '10'
          }
        ],
        completion_criteria: ['Finish required tasks', 123],
        ai_summary: 'Focus on review today.'
      }
    })

    expect(normalized.progress.current_lesson).toBe(4)
    expect(normalized.daily_plan.date).toBe('2026-05-25')
    expect(normalized.daily_plan.available_minutes).toBe(60)
    expect(normalized.daily_plan.plan_type).toBe('')
    expect(normalized.daily_plan.focus_lessons).toEqual([5, 6])
    expect(normalized.daily_plan.tasks).toHaveLength(1)
    expect(normalized.daily_plan.tasks[0]).toMatchObject({
      type: '',
      title: 'Review lesson 5',
      minutes: 10,
      required: true,
      status: 'pending'
    })
    expect(normalized.daily_plan.tasks[0].id).toEqual(expect.any(String))
    expect(normalized.daily_plan.completion_criteria).toEqual(['Finish required tasks'])
    expect(normalized.daily_plan.ai_summary).toBe('Focus on review today.')
    expect(normalized.daily_plan.status).toBe('idle')
    expect(normalized.daily_plan.created_at).toBeNull()
    expect(normalized.daily_plan.completed_at).toBeNull()
  })

  it('normalizes lesson mastery records without breaking existing users', () => {
    const normalized = normalizeData({
      progress: { current_lesson: 8 },
      lesson_mastery: {
        5: {
          grammar: '0.65',
          listening: -1,
          speaking: 2,
          reading: 'bad',
          last_reviewed_at: '2026-05-25T08:00:00.000Z'
        },
        bad: {
          grammar: 0.5
        }
      }
    })

    expect(normalized.progress.current_lesson).toBe(8)
    expect(normalized.lesson_mastery).toEqual({
      '5': {
        grammar: 0.65,
        listening: 0,
        speaking: 1,
        reading: 0,
        last_reviewed_at: '2026-05-25T08:00:00.000Z'
      }
    })
  })

  it('normalizes pattern mastery records without breaking existing users', () => {
    const normalized = normalizeData({
      progress: { current_lesson: 9 },
      pattern_mastery: {
        lesson_5_ni_ikimasu: {
          lesson: '5',
          recognition: '0.8',
          controlled_output: -1,
          free_output: 2,
          last_practiced_at: '2026-05-25T09:00:00.000Z'
        },
        lesson_9_bad: {
          pattern: '',
          lesson: 'bad',
          recognition: 0.3
        }
      }
    })

    expect(normalized.progress.current_lesson).toBe(9)
    expect(normalized.pattern_mastery).toEqual({
      lesson_5_ni_ikimasu: {
        lesson: 5,
        pattern: 'lesson_5_ni_ikimasu',
        recognition: 0.8,
        controlled_output: 0,
        free_output: 1,
        last_practiced_at: '2026-05-25T09:00:00.000Z'
      },
      lesson_9_bad: {
        lesson: 1,
        pattern: 'lesson_9_bad',
        recognition: 0.3,
        controlled_output: 0,
        free_output: 0,
        last_practiced_at: null
      }
    })
  })

  it('stores review items with exercise snapshots', () => {
    const store = useMainStore()

    store.addReviewItem({
      lesson: 1,
      grammar_point: 'A grammar point',
      question_type: 'q_translate',
      original_question: '请造句',
      correct_answer: 'わたしは いきます。',
      exercise_snapshot: {
        id: 'q1',
        type: 'q_translate',
        chinese_prompt: '请造句'
      }
    })

    expect(store.mistakes_book).toHaveLength(1)
    expect(store.mistakes_book[0].exercise_snapshot.type).toBe('q_translate')
    expect(store.mistakes_book[0].question_type).toBe('q_translate')
  })

  it('creates and restores local backup snapshots', () => {
    const store = useMainStore()

    store.progress.current_lesson = 3
    const backup = store.createBackupSnapshot('checkpoint')

    store.progress.current_lesson = 7
    const restored = store.restoreBackupSnapshot(backup.id)

    expect(restored).toBe(true)
    expect(store.progress.current_lesson).toBe(3)
    expect(store.study_backups).toHaveLength(1)
  })

  it('creates a daily plan from rules and marks it complete when required tasks finish', () => {
    const store = useMainStore()

    const dailyPlan = store.createDailyPlanFromRules({
      availableMinutes: 60,
      currentLesson: 10,
      foundationRestartEnabled: true,
      recentMistakeCount: 1,
      date: '2026-05-25'
    })

    expect(dailyPlan.date).toBe('2026-05-25')
    expect(dailyPlan.plan_type).toBe('foundation_review')
    expect(dailyPlan.status).toBe('pending')
    expect(dailyPlan.tasks.length).toBeGreaterThan(0)

    const requiredTasks = dailyPlan.tasks.filter((task) => task.required)
    expect(requiredTasks.length).toBeGreaterThan(0)

    expect(store.setDailyTaskStatus(requiredTasks[0].id, 'in_progress')).toBe(true)
    expect(store.daily_plan.status).toBe('in_progress')

    requiredTasks.forEach((task) => {
      expect(store.setDailyTaskStatus(task.id, 'completed')).toBe(true)
    })

    expect(store.daily_plan.status).toBe('completed')
    expect(store.daily_plan.completed_at).toEqual(expect.any(String))
  })

  it('updates pattern mastery from pattern substitution results', () => {
    const store = useMainStore()

    const updated = store.recordPatternSubstitutionResult({
      lesson: 5,
      pattern: 'N1 は いま Vています',
      isCorrect: true
    })

    expect(updated).toBe(true)
    expect(store.pattern_mastery['N1 は いま Vています']).toMatchObject({
      lesson: 5,
      pattern: 'N1 は いま Vています'
    })
    expect(store.pattern_mastery['N1 は いま Vています'].controlled_output).toBeGreaterThan(0)
    expect(store.pattern_mastery['N1 は いま Vています'].last_practiced_at).toEqual(expect.any(String))
  })

  it('updates lesson mastery listening and speaking from mode results', () => {
    const store = useMainStore()

    expect(
      store.recordListeningPracticeResult({
        lesson: 6,
        isCorrect: true
      })
    ).toBe(true)

    expect(
      store.recordShadowingPracticeResult({
        lesson: 6,
        rating: 4
      })
    ).toBe(true)

    expect(store.lesson_mastery['6'].listening).toBeGreaterThan(0)
    expect(store.lesson_mastery['6'].speaking).toBeGreaterThan(0)
    expect(store.lesson_mastery['6'].last_reviewed_at).toEqual(expect.any(String))
  })

  it('builds a weekly review payload from persisted plan, mastery, and mistakes', () => {
    const store = useMainStore()
    const now = new Date('2026-05-25T10:00:00.000Z').getTime()

    store.daily_plan = {
      ...store.daily_plan,
      date: '2026-05-25',
      available_minutes: 120,
      status: 'in_progress',
      created_at: '2026-05-24T09:00:00.000Z',
      tasks: [
        {
          id: 'task_1',
          type: 'pattern_substitution',
          title: 'Pattern drill',
          minutes: 20,
          required: true,
          status: 'completed'
        },
        {
          id: 'task_2',
          type: 'shadowing',
          title: 'Shadowing',
          minutes: 15,
          required: true,
          status: 'skipped'
        }
      ]
    }
    store.progress.lesson_stats = {
      1: { lesson_id: 1, last_session_at: '2026-05-23T08:00:00.000Z' },
      2: { lesson_id: 2, last_session_at: '2026-05-24T08:00:00.000Z' }
    }
    store.lesson_mastery = {
      '6': {
        grammar: 0.3,
        listening: 0.5,
        speaking: 0.4,
        reading: 0.2,
        last_reviewed_at: '2026-05-24T08:00:00.000Z'
      }
    }
    store.pattern_mastery = {
      pattern_a: {
        lesson: 6,
        pattern: 'pattern_a',
        recognition: 0.4,
        controlled_output: 0.6,
        free_output: 0.2,
        last_practiced_at: '2026-05-24T09:00:00.000Z'
      }
    }
    store.mistakes_book = [
      {
        id: 'm1',
        timestamp: '2026-05-24T07:00:00.000Z',
        mark_type: 'mistake',
        lesson: 6,
        grammar_point: 'N が あります',
        question_type: 'q_translate',
        correct_answer: '机の上に本があります'
      }
    ]

    const payload = store.buildWeeklyReviewPayload(
      {
        target_exam: 'N3',
        priority_skills: ['listening', 'speaking']
      },
      { now }
    )

    expect(payload.weekly_stats).toMatchObject({
      planned_minutes: 120,
      completed_minutes: 20,
      missed_tasks: 1,
      completed_days: 2,
      total_days: 7
    })
    expect(payload.completed_plans).toEqual({ total: 0, partial: 1 })
    expect(payload.skipped_tasks).toHaveLength(1)
    expect(payload.mastery_changes.length).toBeGreaterThanOrEqual(2)
    expect(payload.recent_mistakes).toHaveLength(1)
    expect(payload.context.current_lesson).toBe(1)
    expect(payload.context.target_exam).toBe('N3')
  })
})
