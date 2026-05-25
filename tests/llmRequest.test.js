import { describe, expect, it, vi } from 'vitest'
import { requestServerLlmText } from '../src/server/llmRequest'

describe('llmRequest', () => {
  it('requests text from an OpenAI-compatible provider', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          output_text: 'OpenAI plan text'
        })
    }))

    const text = await requestServerLlmText({
      taskName: 'plan',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: fetchMock,
      providerOptions: {
        env: {
          DEFAULT_LLM_PROVIDER: 'openai',
          OPENAI_API_KEY: 'secret-key',
          OPENAI_BASE_URL: 'https://example.com',
          OPENAI_MODEL: 'gpt-test'
        }
      }
    })

    expect(text).toBe('OpenAI plan text')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requests text from Gemini', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini text' }] } }]
      })
    }))

    const text = await requestServerLlmText({
      taskName: 'plan',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: fetchMock,
      providerOptions: {
        env: {
          DEFAULT_LLM_PROVIDER: 'gemini',
          GEMINI_API_KEY: 'gem-secret',
          GEMINI_MODEL: 'gem-model'
        }
      }
    })

    expect(text).toBe('Gemini text')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requests text from OpenRouter with chat completions', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"router"}' } }]
      })
    }))

    const text = await requestServerLlmText({
      taskName: 'plan',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: fetchMock,
      generationConfig: {
        responseMimeType: 'application/json'
      },
      providerOptions: {
        env: {
          DEFAULT_LLM_PROVIDER: 'openrouter',
          OPENROUTER_API_KEY: 'router-key',
          OPENROUTER_BASE_URL: 'https://openrouter.ai/api',
          OPENROUTER_MODEL: 'minimax/minimax-m2.7'
        }
      }
    })

    expect(text).toBe('{"summary":"router"}')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(options.headers['X-Title']).toBe('Minna no Nihongo AI Tutor')
  })

  it('retries on retryable HTTP status codes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: { message: 'retry please' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ output_text: 'Recovered text' })
      })

    const text = await requestServerLlmText({
      taskName: 'plan',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: fetchMock,
      providerOptions: {
        env: {
          DEFAULT_LLM_PROVIDER: 'openai',
          OPENAI_API_KEY: 'secret-key',
          OPENAI_BASE_URL: 'https://example.com'
        }
      }
    })

    expect(text).toBe('Recovered text')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns safe errors without leaking secrets', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'bad auth' } })
    }))

    await expect(
      requestServerLlmText({
        taskName: 'plan',
        systemPrompt: 'system',
        userPrompt: 'user',
        fetchImpl: fetchMock,
        providerOptions: {
          env: {
            DEFAULT_LLM_PROVIDER: 'openai',
            OPENAI_API_KEY: 'secret-key',
            OPENAI_BASE_URL: 'https://example.com'
          }
        }
      })
    ).rejects.toThrow(/401/)

    await expect(
      requestServerLlmText({
        taskName: 'plan',
        systemPrompt: 'system',
        userPrompt: 'user',
        fetchImpl: fetchMock,
        providerOptions: {
          env: {
            DEFAULT_LLM_PROVIDER: 'openai',
            OPENAI_API_KEY: 'secret-key',
            OPENAI_BASE_URL: 'https://example.com'
          }
        }
      })
    ).rejects.not.toThrow(/secret-key/)
  })
})
