const DEFAULT_STORAGE_KEY = 'minna_app_data'
const DEFAULT_SYNC_URL = '/api/save-progress'
const DEFAULT_STATE_LOAD_URL = '/api/state/load'
const DEFAULT_STATE_SAVE_URL = '/api/state/save'
const DEFAULT_STATE_PATCH_URL = '/api/state/patch'

const getSafeLocalStorage = (storageOverride) => {
  if (storageOverride) return storageOverride
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  return null
}

const getSafeFetch = (fetchOverride) => {
  if (fetchOverride) return fetchOverride
  if (typeof fetch === 'function') return fetch
  return null
}

const parseStoredState = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return null
  return JSON.parse(rawValue)
}

const getRuntimeMode = (options = {}) => {
  const explicitMode = String(options.mode || '').toLowerCase()
  if (explicitMode === 'deployed' || explicitMode === 'local') {
    return explicitMode
  }

  if (typeof window === 'undefined') return 'local'
  const runtimeMode = String(window?.CONFIG?.APP_RUNTIME_MODE || '').toLowerCase()
  if (runtimeMode === 'deployed') return 'deployed'

  return 'local'
}

const createLocalPersistenceAdapter = (options = {}) => {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY
  const syncUrl = options.syncUrl || DEFAULT_SYNC_URL
  const resolveStorage = () => getSafeLocalStorage(options.storage)
  const resolveFetch = () => getSafeFetch(options.fetch)

  const load = () => {
    const storage = resolveStorage()
    if (!storage) return null
    const rawValue = storage.getItem(storageKey)
    return parseStoredState(rawValue)
  }

  const save = (state) => {
    const stateStr = JSON.stringify(state, null, 2)
    const storage = resolveStorage()
    const fetchImpl = resolveFetch()

    if (storage) {
      storage.setItem(storageKey, stateStr)
    }

    if (fetchImpl) {
      fetchImpl(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stateStr
      }).catch((error) => {
        console.warn('Failed to sync progress to local disk.', error)
      })
    }

    return state
  }

  const patch = (updater) => {
    const current = load() || {}
    const nextState =
      typeof updater === 'function'
        ? updater(current)
        : {
            ...current,
            ...(updater || {})
          }

    return save(nextState)
  }

  return {
    load,
    save,
    patch
  }
}

const createDeployedPersistenceAdapter = (options = {}) => {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY
  const resolveStorage = () => getSafeLocalStorage(options.storage)
  const resolveFetch = () => getSafeFetch(options.fetch)

  const load = () => {
    const storage = resolveStorage()
    if (!storage) return null
    return parseStoredState(storage.getItem(storageKey))
  }

  const loadRemote = async () => {
    const fetchImpl = resolveFetch()
    if (!fetchImpl) return null

    const response = await fetchImpl(options.stateLoadUrl || DEFAULT_STATE_LOAD_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      throw new Error(`State load failed with status ${response.status}`)
    }

    const parsed = await response.json()
    return parsed?.data || null
  }

  const save = async (state) => {
    const stateStr = JSON.stringify(state, null, 2)
    const storage = resolveStorage()
    const fetchImpl = resolveFetch()

    if (storage) {
      storage.setItem(storageKey, stateStr)
    }

    if (!fetchImpl) return state

    const response = await fetchImpl(options.stateSaveUrl || DEFAULT_STATE_SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stateStr
    })

    if (!response.ok) {
      throw new Error(`State save failed with status ${response.status}`)
    }

    return state
  }

  const patch = async (updater) => {
    const current = load() || {}
    const nextState =
      typeof updater === 'function'
        ? updater(current)
        : {
            ...current,
            ...(updater || {})
          }

    const fetchImpl = resolveFetch()
    if (fetchImpl) {
      const response = await fetchImpl(options.statePatchUrl || DEFAULT_STATE_PATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextState, null, 2)
      })
      if (!response.ok) {
        throw new Error(`State patch failed with status ${response.status}`)
      }
    }

    const storage = resolveStorage()
    if (storage) {
      storage.setItem(storageKey, JSON.stringify(nextState, null, 2))
    }

    return nextState
  }

  return {
    mode: 'deployed',
    load,
    loadRemote,
    save,
    patch
  }
}

const createRuntimePersistenceAdapter = (options = {}) => {
  const runtimeMode = getRuntimeMode(options)
  if (runtimeMode === 'deployed') {
    return createDeployedPersistenceAdapter(options)
  }

  return {
    mode: 'local',
    ...createLocalPersistenceAdapter(options),
    loadRemote: async () => null
  }
}

export {
  DEFAULT_STATE_LOAD_URL,
  DEFAULT_STATE_PATCH_URL,
  DEFAULT_STATE_SAVE_URL,
  DEFAULT_STORAGE_KEY,
  DEFAULT_SYNC_URL,
  createDeployedPersistenceAdapter,
  createLocalPersistenceAdapter,
  createRuntimePersistenceAdapter,
  getRuntimeMode
}
