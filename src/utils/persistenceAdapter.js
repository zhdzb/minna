const DEFAULT_STORAGE_KEY = 'minna_app_data'
const DEFAULT_SYNC_URL = '/api/save-progress'

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

export { DEFAULT_STORAGE_KEY, DEFAULT_SYNC_URL, createLocalPersistenceAdapter }
