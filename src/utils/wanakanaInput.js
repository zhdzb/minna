const getWanakana = () => {
  if (typeof window === 'undefined') return null
  const candidate = window.wanakana
  if (!candidate || typeof candidate.toKana !== 'function') {
    return null
  }
  return candidate
}

const toKanaInput = (value) => {
  const text = String(value || '')
  const wanakana = getWanakana()
  if (!wanakana) return text

  return wanakana.toKana(text, {
    IMEMode: true
  })
}

export { toKanaInput }
