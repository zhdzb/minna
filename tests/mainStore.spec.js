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
      ai_summary: ''
    })
    expect(store.lesson_mastery).toEqual({})
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
})
