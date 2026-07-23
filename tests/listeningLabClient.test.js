import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LISTENING_LAB_API_BASE,
  buildListeningLabUrl,
  createListeningLabClient
} from '../src/utils/listeningLabClient.js'

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ success: true, data })
})

describe('Listening Lab client', () => {
  it('loads, generates, saves, submits and retries through isolated endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ latestSession: { id: 'session-1' } }))
    const client = createListeningLabClient({ fetchImpl: fetchMock })
    const attempt = { id: 'attempt-1' }

    await client.loadDashboard()
    await client.generateSession()
    await client.saveAttempt(attempt)
    await client.submitAttempt(attempt)
    await client.retrySession('session-1')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/listening-lab/',
      '/api/listening-lab/generate',
      '/api/listening-lab/attempt/save',
      '/api/listening-lab/attempt/submit',
      '/api/listening-lab/retry'
    ])
    expect(client.buildRecordingUrl('study/listening/audio/a.webm')).toContain(
      '/api/listening-lab/recording?path='
    )
  })

  it('normalizes URLs and exposes the independent API base', () => {
    expect(DEFAULT_LISTENING_LAB_API_BASE).toBe('/api/listening-lab')
    expect(buildListeningLabUrl('/api/listening-lab/', '/generate')).toBe(
      '/api/listening-lab/generate'
    )
  })
})
