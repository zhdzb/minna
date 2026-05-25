import fs from 'fs'
import path from 'path'

const DEFAULT_STATE_FILE = path.resolve(process.cwd(), 'data.json')

const safeParseJson = (raw, fallback = null) => {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  try {
    return JSON.parse(raw)
  } catch (_error) {
    return fallback
  }
}

const createFilePersistenceAdapter = (options = {}) => {
  const stateFile = options.stateFile || DEFAULT_STATE_FILE

  const load = async () => {
    try {
      if (!fs.existsSync(stateFile)) return null
      const raw = fs.readFileSync(stateFile, 'utf8')
      return safeParseJson(raw, null)
    } catch (_error) {
      return null
    }
  }

  const save = async (state) => {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8')
    return state
  }

  const patch = async (updater) => {
    const current = (await load()) || {}
    const nextState =
      typeof updater === 'function'
        ? updater(current)
        : {
            ...current,
            ...(updater || {})
          }

    return save(nextState)
  }

  return { load, save, patch }
}

const createMemoryPersistenceAdapter = (initialState = null) => {
  let memoryState = initialState

  const load = async () => memoryState
  const save = async (state) => {
    memoryState = state
    return memoryState
  }
  const patch = async (updater) => {
    const current = memoryState || {}
    memoryState =
      typeof updater === 'function'
        ? updater(current)
        : {
            ...current,
            ...(updater || {})
          }
    return memoryState
  }

  return { load, save, patch }
}

const isDeployedMode = (env = process.env) =>
  String(env.APP_RUNTIME_MODE || '').toLowerCase() === 'deployed' ||
  String(env.DEPLOYED_MODE || '').toLowerCase() === 'true' ||
  String(env.VERCEL || '') === '1'

const createServerPersistenceAdapter = (options = {}) => {
  const env = options.env || process.env
  if (isDeployedMode(env)) {
    return createMemoryPersistenceAdapter(options.initialState || null)
  }

  return createFilePersistenceAdapter({
    stateFile: options.stateFile
  })
}

export {
  DEFAULT_STATE_FILE,
  createFilePersistenceAdapter,
  createMemoryPersistenceAdapter,
  createServerPersistenceAdapter,
  isDeployedMode
}
