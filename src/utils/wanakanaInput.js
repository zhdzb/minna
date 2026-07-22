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

  if (start === null || end === null) {
    return {
      value: toKanaInput(text),
      selectionStart: null,
      selectionEnd: null
    }
  }

  const selectionFrom = Math.min(start, end)
  const selectionTo = Math.max(start, end)
  const convertedBeforeSelection = toKanaInput(text.slice(0, selectionFrom))
  const convertedThroughSelection = toKanaInput(text.slice(0, selectionTo))

  return {
    // Text after the caret must not force an unfinished romaji syllable to commit.
    value: convertedThroughSelection + text.slice(selectionTo),
    selectionStart: convertedBeforeSelection.length,
    selectionEnd: convertedThroughSelection.length
  }
}

export { toKanaInput, toKanaInputWithSelection }
