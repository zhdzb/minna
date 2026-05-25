import { describe, expect, it } from 'vitest'
import { getServerProviderConfig, getTaskProvider, normalizeProvider } from '../src/server/providerConfig'

describe('providerConfig', () => {
  it('normalizes provider names to the supported set', () => {
    expect(normalizeProvider('OPENAI')).toBe('openai')
    expect(normalizeProvider('OpenRouter')).toBe('openrouter')
    expect(normalizeProvider('gemini')).toBe('gemini')
    expect(normalizeProvider('anything-else')).toBe('gemini')
  })

  it('builds server-side provider config from env values', () => {
    const config = getServerProviderConfig({
      env: {
        DEFAULT_LLM_PROVIDER: 'openai',
        PLAN_LLM_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gem-key',
        GEMINI_MODEL: 'gem-model',
        OPENAI_API_KEY: 'open-key',
        OPENAI_MODEL: 'open-model',
        OPENAI_BASE_URL: 'https://example.com',
        OPENAI_REASONING_EFFORT: 'high'
      }
    })

    expect(config.defaultProvider).toBe('openai')
    expect(config.taskProviders.plan).toBe('gemini')
    expect(config.gemini.model).toBe('gem-model')
    expect(config.openai.baseUrl).toBe('https://example.com')
    expect(config.publicStatus.availableProviders).toEqual({
      gemini: true,
      openai: true,
      openrouter: false
    })
  })

  it('builds dedicated openrouter config from env values', () => {
    const config = getServerProviderConfig({
      env: {
        DEFAULT_LLM_PROVIDER: 'openrouter',
        OPENROUTER_API_KEY: 'router-key',
        OPENROUTER_MODEL: 'minimax/minimax-m2.7',
        OPENROUTER_BASE_URL: 'https://openrouter.ai/api'
      }
    })

    expect(config.defaultProvider).toBe('openrouter')
    expect(config.openrouter.apiKey).toBe('router-key')
    expect(config.openrouter.model).toBe('minimax/minimax-m2.7')
    expect(config.publicStatus.availableProviders.openrouter).toBe(true)
  })

  it('allows task-specific provider overrides', () => {
    const provider = getTaskProvider('evaluation', {
      env: {
        DEFAULT_LLM_PROVIDER: 'gemini'
      },
      overrides: {
        taskProviders: {
          evaluation: 'openai'
        }
      }
    })

    expect(provider).toBe('openai')
  })

  it('exposes public status without leaking secret values', () => {
    const config = getServerProviderConfig({
      env: {
        GEMINI_API_KEY: 'gem-key',
        OPENAI_API_KEY: 'open-key'
      }
    })

    expect(config.publicStatus.defaultProvider).toBe('gemini')
    expect(config.publicStatus.availableProviders).toEqual({
      gemini: true,
      openai: true,
      openrouter: false
    })
    expect(config.publicStatus).not.toHaveProperty('gemini')
    expect(config.publicStatus).not.toHaveProperty('openai')
  })
})
