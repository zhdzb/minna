import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AGENT_STUDY_API_BASE,
  buildAgentStudyUrl,
  createAgentStudyClient
} from '../src/utils/agentStudyClient'

const createJsonResponse = ({ ok = true, status = 200, body = null } = {}) => ({
  ok,
  status,
  text: vi.fn().mockResolvedValue(body === null ? '' : JSON.stringify(body))
})

describe('agentStudyClient', () => {
  it('loads the latest agent study payload through the shared API shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: {
            dailyPacket: { id: 'daily-2026-06-26' }
          }
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })

    await expect(client.loadLatestAgentStudy()).resolves.toEqual({
      dailyPacket: { id: 'daily-2026-06-26' }
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/agent-study/latest', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  })

  it('sends daily packet saves through the save endpoint with optional targetPath', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: {
            targetPath: 'study/daily/2026-06-26.json'
          }
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })
    const dailyPacket = { id: 'daily-2026-06-26', revision: 3 }

    await expect(
      client.saveDailyPacket({
        dailyPacket,
        targetPath: ' study/daily/2026-06-26.json '
      })
    ).resolves.toEqual({
      targetPath: 'study/daily/2026-06-26.json'
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/agent-study/daily/save', {
      method: 'POST',
      body: JSON.stringify({
        dailyPacket,
        targetPath: 'study/daily/2026-06-26.json'
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    })
  })

  it('throws API error messages for non-success JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        ok: false,
        status: 409,
        body: {
          success: false,
          error: 'Revision conflict detected'
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })

    await expect(client.submitDailyPacket({ dailyPacket: { id: 'daily-2026-06-26' } })).rejects.toMatchObject({
      message: 'Revision conflict detected',
      status: 409
    })
  })

  it('loads latest review and returns null when the API data payload is null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: null
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock, baseUrl: '/custom-agent-study/' })

    await expect(client.loadLatestReview()).resolves.toBe(null)
    expect(fetchMock).toHaveBeenCalledWith('/custom-agent-study/review/latest', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  })

  it('loads the latest review drill packet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: {
            id: 'review-drill-2026-06-30'
          }
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })

    await expect(client.loadLatestReviewDrill()).resolves.toEqual({
      id: 'review-drill-2026-06-30'
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/agent-study/review-drill/latest', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  })

  it('loads the progress review payload through the progress endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: {
            current: { current_lesson: 7 },
            recentEvents: []
          }
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })

    await expect(client.loadProgressReview()).resolves.toEqual({
      current: { current_lesson: 7 },
      recentEvents: []
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/agent-study/progress', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  })

  it('loads a prompt file through the prompt endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        body: {
          success: true,
          data: {
            path: 'study/prompts/generated/2026-06-26-review.md',
            content: 'Review prompt body'
          }
        }
      })
    )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })

    await expect(client.loadPromptFile('study/prompts/generated/2026-06-26-review.md')).resolves.toEqual({
      path: 'study/prompts/generated/2026-06-26-review.md',
      content: 'Review prompt body'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent-study/prompt?path=study%2Fprompts%2Fgenerated%2F2026-06-26-review.md',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      }
    )
  })

  it('loads and saves syllabus documents through the syllabus endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          body: {
            success: true,
            data: {
              question_types: [{ id: 'q_fill', name: '填空', desc: 'desc', difficulty_range: [1, 2] }],
              lessons: [{ id: 1, title: '第1课', theme: '自我介绍', grammar_points: ['A'], sentence_patterns: ['B'], hidden_knowledge: ['C'], core_vocabulary: [], enabled_question_types: ['q_fill'] }]
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          body: {
            success: true,
            data: {
              saved: true
            }
          }
        })
      )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })
    const syllabus = {
      question_types: [{ id: 'q_fill', name: '填空', desc: 'desc', difficulty_range: [1, 2] }],
      lessons: [{ id: 1, title: '第1课', theme: '自我介绍', grammar_points: ['A'], sentence_patterns: ['B'], hidden_knowledge: ['C'], core_vocabulary: [], enabled_question_types: ['q_fill'] }]
    }

    await expect(client.loadSyllabus()).resolves.toEqual(syllabus)
    await expect(client.saveSyllabus(syllabus)).resolves.toEqual({ saved: true })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/agent-study/syllabus', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/agent-study/syllabus', {
      method: 'POST',
      body: JSON.stringify(syllabus),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    })
  })

  it('sends review drill saves and submits through the review-drill endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          body: {
            success: true,
            data: {
              targetPath: 'study/review-drills/2026-06-30.json'
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          body: {
            success: true,
            data: {
              reviewDrill: {
                status: 'submitted'
              }
            }
          }
        })
      )
    const client = createAgentStudyClient({ fetchImpl: fetchMock })
    const reviewDrill = { id: 'review-drill-2026-06-30', revision: 2 }

    await expect(
      client.saveReviewDrill({
        reviewDrill,
        targetPath: ' study/review-drills/2026-06-30.json '
      })
    ).resolves.toEqual({
      targetPath: 'study/review-drills/2026-06-30.json'
    })

    await expect(client.submitReviewDrill({ reviewDrill })).resolves.toEqual({
      reviewDrill: {
        status: 'submitted'
      }
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/agent-study/review-drill/save', {
      method: 'POST',
      body: JSON.stringify({
        reviewDrill,
        targetPath: 'study/review-drills/2026-06-30.json'
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    })

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/agent-study/review-drill/submit', {
      method: 'POST',
      body: JSON.stringify({
        reviewDrill
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    })
  })

  it('throws a clear error when fetch support is unavailable', async () => {
    const client = createAgentStudyClient({ fetchImpl: null })

    await expect(client.loadLatestAgentStudy()).rejects.toThrow(/requires fetch support/)
  })

  it('builds normalized endpoint URLs from the default API base', () => {
    expect(DEFAULT_AGENT_STUDY_API_BASE).toBe('/api/agent-study')
    expect(buildAgentStudyUrl('/api/agent-study/', '/daily/save')).toBe('/api/agent-study/daily/save')
  })
})
