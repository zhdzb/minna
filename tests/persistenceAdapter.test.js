import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STORAGE_KEY,
  DEFAULT_SYNC_URL,
  createLocalPersistenceAdapter
} from '../src/utils/persistenceAdapter'

const createMemoryStorage = () => {
  const data = new Map()

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, value)
    }
  }
}

describe('persistenceAdapter', () => {
  let storage
  let fetchMock

  beforeEach(() => {
    storage = createMemoryStorage()
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
  })

  it('loads persisted state from storage', () => {
    storage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify({ progress: { current_lesson: 3 } }))
    const adapter = createLocalPersistenceAdapter({ storage, fetch: fetchMock })

    expect(adapter.load()).toEqual({ progress: { current_lesson: 3 } })
  })

  it('saves state to storage and sync endpoint', () => {
    const adapter = createLocalPersistenceAdapter({ storage, fetch: fetchMock })
    const state = { progress: { current_lesson: 4 } }

    adapter.save(state)

    expect(JSON.parse(storage.getItem(DEFAULT_STORAGE_KEY))).toEqual(state)
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state, null, 2)
    })
  })

  it('patches the current state through the shared adapter contract', () => {
    storage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify({ progress: { current_lesson: 4 }, daily_plan: {} }))
    const adapter = createLocalPersistenceAdapter({ storage, fetch: fetchMock })

    const nextState = adapter.patch((current) => ({
      ...current,
      progress: {
        ...current.progress,
        current_lesson: current.progress.current_lesson + 1
      }
    }))

    expect(nextState.progress.current_lesson).toBe(5)
    expect(JSON.parse(storage.getItem(DEFAULT_STORAGE_KEY)).progress.current_lesson).toBe(5)
  })
})
