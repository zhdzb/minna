import { describe, expect, it, vi } from 'vitest'
import {
  handleGenerateListeningSession,
  handleGetListeningLab,
  handleRetryListeningSession,
  handleSaveListeningAttempt,
  handleSaveListeningRecording,
  handleSubmitListeningAttempt
} from '../src/server/listeningLab/routes.js'

describe('Listening Lab routes', () => {
  it('delegates lifecycle actions to the independent store', async () => {
    const store = {
      loadDashboard: vi.fn().mockReturnValue({ index: {} }),
      generateSession: vi.fn().mockReturnValue({ generated: true }),
      saveAttempt: vi.fn().mockReturnValue({ saved: true }),
      submitAttempt: vi.fn().mockReturnValue({ submitted: true }),
      retrySession: vi.fn().mockReturnValue({ retried: true }),
      saveRecording: vi.fn().mockReturnValue({ recorded: true })
    }
    const attempt = { id: 'attempt-1' }

    await expect(handleGetListeningLab({ store })).resolves.toEqual({ index: {} })
    await expect(
      handleGenerateListeningSession({ scenarioId: 'morning-meeting' }, { store })
    ).resolves.toEqual({ generated: true })
    await expect(handleSaveListeningAttempt({ attempt }, { store })).resolves.toEqual({
      saved: true
    })
    await expect(handleSubmitListeningAttempt({ attempt }, { store })).resolves.toEqual({
      submitted: true
    })
    await expect(
      handleRetryListeningSession({ sessionId: 'session-1' }, { store })
    ).resolves.toEqual({ retried: true })
    await expect(
      handleSaveListeningRecording(
        {
          attemptId: 'attempt-1',
          segmentId: 'segment-1',
          dataUrl: 'data:audio/webm;base64,QQ=='
        },
        { store }
      )
    ).resolves.toEqual({ recorded: true })

    expect(store.generateSession).toHaveBeenCalledWith({
      scenarioId: 'morning-meeting'
    })
    expect(store.retrySession).toHaveBeenCalledWith({ sessionId: 'session-1' })
  })
})
