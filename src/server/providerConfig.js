const DEFAULT_SERVER_PROVIDER = 'gemini'
const DEFAULT_OPENAI_BASE_URL = 'https://llmapi.devart.ai'
const DEFAULT_OPENAI_MODEL = 'gpt-5.4'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_REASONING_EFFORT = 'xhigh'

const normalizeProvider = (provider) => {
  const value = String(provider || '').trim().toLowerCase()
  return value === 'openai' ? 'openai' : 'gemini'
}

const getEnvValue = (env, key, fallback = '') => {
  const value = env?.[key]
  return value == null || value === '' ? fallback : value
}

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
      apiKey: overrides.geminiApiKey || getEnvValue(env, 'GEMINI_API_KEY'),
      model: overrides.geminiModel || getEnvValue(env, 'GEMINI_MODEL', DEFAULT_GEMINI_MODEL)
    },
    openai: {
      apiKey: overrides.openaiApiKey || getEnvValue(env, 'OPENAI_API_KEY'),
      model: overrides.openaiModel || getEnvValue(env, 'OPENAI_MODEL', DEFAULT_OPENAI_MODEL),
      baseUrl: overrides.openaiBaseUrl || getEnvValue(env, 'OPENAI_BASE_URL', DEFAULT_OPENAI_BASE_URL),
      reasoningEffort:
        overrides.openaiReasoningEffort ||
        getEnvValue(env, 'OPENAI_REASONING_EFFORT', DEFAULT_REASONING_EFFORT)
    },
    publicStatus: {
      ...providerStatus,
      availableProviders: {
        gemini: !!(overrides.geminiApiKey || getEnvValue(env, 'GEMINI_API_KEY')),
        openai: !!(overrides.openaiApiKey || getEnvValue(env, 'OPENAI_API_KEY'))
      }
    }
  }
}

const getTaskProvider = (taskName, options = {}) => {
  const config = getServerProviderConfig(options)
  return config.taskProviders?.[taskName] || config.defaultProvider
}

export { getServerProviderConfig, getTaskProvider, normalizeProvider }
