import { setActivePinia, createPinia } from 'pinia'
import { useMainStore } from '../src/store/mainStore'

// 模拟 LocalStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('MainStore Pinia State Tests', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        window.localStorage.clear()
    })

    it('Initializes with default data when localStorage is empty', () => {
        const store = useMainStore()
        expect(store.progress.current_lesson).toBe(1)
        expect(store.mistakes_book.length).toBe(0)
        expect(store.progress.completed_types_by_lesson).toEqual({})
    })

    it('Correctly overwrites state and dumps to Storage when overwriteState is called', () => {
        const store = useMainStore()
        const fakeData = {
           progress: { current_lesson: 3, completed_types_by_lesson: { "1": ["q_fill"] } },
           mistakes_book: [{ id: "m1", grammar_point: "q_fill" }],
           collections: []
        }
        
        store.overwriteState(fakeData)
        expect(store.progress.current_lesson).toBe(3)
        expect(store.mistakes_book.length).toBe(1)

        // Verify LocalStorage serialization
        const savedRaw = window.localStorage.getItem('minna_no_nihongo_data')
        const saved = JSON.parse(savedRaw)
        expect(saved.progress.current_lesson).toBe(3)
    })

    it('Adds a mistake to the mistake book with a generated ID and Timestamp', () => {
        const store = useMainStore()
        store.addMistake({
            lesson: 1,
            grammar_point: "q_fill",
            user_wrong_input: "だ",
            correct_answer: "です"
        })

        expect(store.mistakes_book.length).toBe(1)
        expect(store.mistakes_book[0].user_wrong_input).toBe("だ")
        expect(store.mistakes_book[0].id).toBeDefined()
        expect(store.mistakes_book[0].timestamp).toBeDefined()
    })
})
