import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../src/store/mainStore'

describe('mainStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }))
  })

  it('initializes with the new default shape', () => {
    const store = useMainStore()

    expect(store.progress.current_lesson).toBe(1)
    expect(store.mistakes_book).toEqual([])
    expect(store.study_backups).toEqual([])
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
