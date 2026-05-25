const DEFAULT_SERVER_PROVIDER = 'gemini'
const DEFAULT_OPENAI_BASE_URL = 'https://llmapi.devart.ai'
const DEFAULT_OPENAI_MODEL = 'gpt-5.4'
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api'
const DEFAULT_OPENROUTER_MODEL = 'minimax/minimax-m2.7'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_REASONING_EFFORT = 'xhigh'

const normalizeProvider = (provider) => {
  const value = String(provider || '').trim().toLowerCase()
  if (value === 'openai') return 'openai'
  if (value === 'openrouter') return 'openrouter'
  return 'gemini'
}

const getEnvValue = (env, key, fallback = '') => {
  const value = env?.[key]
  return value == null || value === '' ? fallback : value
}

const sanitizeApiKey = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '')

const getServerProviderConfig = (options = {}) => {
  const env = options.env || process.env
  const overrides = options.overrides || {}
  const taskProviders = overrides.taskProviders || {}

  const defaultProvider = normalizeProvider(
    overrides.defaultProvider || getEnvValue(env, 'DEFAULT_LLM_PROVIDER', DEFAULT_SERVER_PROVIDER)
  )

  const providerStatus = {
    defaultProvider,
    taskProviders: {
      plan: normalizeProvider(taskProviders.plan || getEnvValue(env, 'PLAN_LLM_PROVIDER', defaultProvider)),
      exercise: normalizeProvider(
        taskProviders.exercise || getEnvValue(env, 'EXERCISE_LLM_PROVIDER', defaultProvider)
      ),
      evaluation: normalizeProvider(
        taskProviders.evaluation || getEnvValue(env, 'EVALUATION_LLM_PROVIDER', defaultProvider)
      ),
      summary: normalizeProvider(
        taskProviders.summary || getEnvValue(env, 'SUMMARY_LLM_PROVIDER', defaultProvider)
      )
    }
  }

  return {
    defaultProvider,
    taskProviders: providerStatus.taskProviders,
    gemini: {
      apiKey: sanitizeApiKey(overrides.geminiApiKey || getEnvValue(env, 'GEMINI_API_KEY')),
      model: overrides.geminiModel || getEnvValue(env, 'GEMINI_MODEL', DEFAULT_GEMINI_MODEL)
    },
    openai: {
      apiKey: sanitizeApiKey(overrides.openaiApiKey || getEnvValue(env, 'OPENAI_API_KEY')),
      model: overrides.openaiModel || getEnvValue(env, 'OPENAI_MODEL', DEFAULT_OPENAI_MODEL),
      baseUrl: overrides.openaiBaseUrl || getEnvValue(env, 'OPENAI_BASE_URL', DEFAULT_OPENAI_BASE_URL),
      reasoningEffort:
        overrides.openaiReasoningEffort ||
        getEnvValue(env, 'OPENAI_REASONING_EFFORT', DEFAULT_REASONING_EFFORT)
    },
    openrouter: {
      apiKey: sanitizeApiKey(overrides.openrouterApiKey || getEnvValue(env, 'OPENROUTER_API_KEY')),
      model: overrides.openrouterModel || getEnvValue(env, 'OPENROUTER_MODEL', DEFAULT_OPENROUTER_MODEL),
      baseUrl:
        overrides.openrouterBaseUrl || getEnvValue(env, 'OPENROUTER_BASE_URL', DEFAULT_OPENROUTER_BASE_URL)
    },
    publicStatus: {
      ...providerStatus,
      availableProviders: {
        gemini: !!(overrides.geminiApiKey || getEnvValue(env, 'GEMINI_API_KEY')),
        openai: !!(overrides.openaiApiKey || getEnvValue(env, 'OPENAI_API_KEY')),
        openrouter: !!(overrides.openrouterApiKey || getEnvValue(env, 'OPENROUTER_API_KEY'))
      }
    }
  }
}

const getTaskProvider = (taskName, options = {}) => {
  const config = getServerProviderConfig(options)
  return config.taskProviders?.[taskName] || config.defaultProvider
}

export { getServerProviderConfig, getTaskProvider, normalizeProvider }
