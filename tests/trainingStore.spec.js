import { setActivePinia, createPinia } from 'pinia'
import { useTrainingStore } from '../src/store/trainingStore'

describe('TrainingStore Pinia Tests', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('Initializes session clears old data and resets phase', () => {
        const store = useTrainingStore()
        
        // Setup dirty state
        store.evaluations = [{ is_correct: true }]
        store.currentPhase = 'results'
        store.generationError = 'Network error'
        
        // Init new session
        store.initSession({ difficulty: 'JLPT真题级' })
        
        expect(store.currentPhase).toBe('answering')
        expect(store.evaluations.length).toBe(0)
        expect(store.generationError).toBe('')
        expect(store.currentConfig.difficulty).toBe('JLPT真题级')
        expect(store.activeQuestionId).toBeNull()
    })

    it('Sets active question automatically when exercises are injected', () => {
        const store = useTrainingStore()
        
        const mockGenerated = [
            { id: 'uuid-1', type: 'q_fill' },
            { id: 'uuid-2', type: 'q_translate' }
        ]

        store.setExercises(mockGenerated)
        expect(store.exercises.length).toBe(2)
        expect(store.activeQuestionId).toBe('uuid-1')
    })
})
