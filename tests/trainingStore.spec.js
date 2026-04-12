import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTrainingStore } from '../src/store/trainingStore'

describe('trainingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resets the session state when a new session starts', () => {
    const store = useTrainingStore()

    store.setExercises([{ id: 'old', type: 'q_fill' }])
    store.setEvaluations([{ id: 'old', is_correct: true }])
    store.generationError = 'failed'

    store.initSession({ difficulty: 'JLPT真题级' }, 'ts-1')

    expect(store.currentPhase).toBe('answering')
    expect(store.exercises).toEqual([])
    expect(store.evaluations).toEqual([])
    expect(store.generationError).toBe('')
    expect(store.currentConfig.difficulty).toBe('JLPT真题级')
    expect(store.sessionTimestamp).toBe('ts-1')
  })

  it('selects the first question after exercises are injected', () => {
    const store = useTrainingStore()

    store.setExercises([
      { id: 'q1', type: 'q_fill' },
      { id: 'q2', type: 'q_translate' }
    ])

    expect(store.activeQuestionId).toBe('q1')
  })
})
