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

const clampSelection = (value, textLength) => {
  if (!Number.isInteger(value)) return null
  return Math.max(0, Math.min(value, textLength))
}

const toKanaInputWithSelection = (value, selectionStart, selectionEnd = selectionStart) => {
  const text = String(value || '')
  const start = clampSelection(selectionStart, text.length)
  const end = clampSelection(selectionEnd, text.length)
  const convertedValue = toKanaInput(text)

  if (start === null || end === null) {
    return {
      value: convertedValue,
      selectionStart: null,
      selectionEnd: null
    }
  }

  return {
    value: convertedValue,
    selectionStart: toKanaInput(text.slice(0, start)).length,
    selectionEnd: toKanaInput(text.slice(0, end)).length
  }
}

export { toKanaInput, toKanaInputWithSelection }
