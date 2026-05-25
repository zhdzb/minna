const assertJsonObject = (payload, label) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label} requires a JSON object payload`)
  }
  return payload
}

const handleLoadStudyState = async ({ adapter }) => {
  if (!adapter || typeof adapter.load !== 'function') {
    throw new Error('study state load route requires a persistence adapter')
  }

  const state = await adapter.load()
  return state || null
}

const handleSaveStudyState = async (payload, { adapter }) => {
  if (!adapter || typeof adapter.save !== 'function') {
    throw new Error('study state save route requires a persistence adapter')
  }

  const normalized = assertJsonObject(payload, 'study state save route')
  return adapter.save(normalized)
}

const handlePatchStudyState = async (payload, { adapter }) => {
  if (!adapter || typeof adapter.patch !== 'function') {
    throw new Error('study state patch route requires a persistence adapter')
  }

  const normalized = assertJsonObject(payload, 'study state patch route')
  return adapter.patch(normalized)
}

export { handleLoadStudyState, handleSaveStudyState, handlePatchStudyState }
