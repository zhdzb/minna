import { describe, expect, it, vi } from 'vitest'
import {
  handleLoadStudyState,
  handlePatchStudyState,
  handleSaveStudyState
} from '../src/server/routes/studyStateRoute'

describe('studyStateRoute', () => {
  it('loads state via adapter', async () => {
    const adapter = {
      load: vi.fn(async () => ({ progress: { current_lesson: 8 } }))
    }

    const result = await handleLoadStudyState({ adapter })
    expect(result.progress.current_lesson).toBe(8)
  })

  it('saves state via adapter', async () => {
    const adapter = {
      save: vi.fn(async (payload) => payload)
    }

    const result = await handleSaveStudyState(
      { progress: { current_lesson: 9 } },
      { adapter }
    )

    expect(adapter.save).toHaveBeenCalledTimes(1)
    expect(result.progress.current_lesson).toBe(9)
  })

  it('patches state via adapter', async () => {
    const adapter = {
      patch: vi.fn(async (payload) => ({ progress: { current_lesson: 10 }, ...payload }))
    }

    const result = await handlePatchStudyState(
      { daily_plan: { status: 'pending' } },
      { adapter }
    )

    expect(adapter.patch).toHaveBeenCalledTimes(1)
    expect(result.progress.current_lesson).toBe(10)
  })
})
