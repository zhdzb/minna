import { onBeforeUnmount, ref } from 'vue'

const splitSpeechText = (value) => {
  const text = String(value || '').trim()
  if (!text) return []

  return (text.match(/[^。！？!?]+[。！？!?]*/gu) || [text])
    .map((segment) => segment.trim())
    .filter(Boolean)
}

const getSpeechSupport = () => {
  if (typeof window === 'undefined') return null
  const synthesis = window.speechSynthesis
  const Utterance = window.SpeechSynthesisUtterance
  if (!synthesis || typeof synthesis.speak !== 'function' || typeof Utterance !== 'function') {
    return null
  }
  return { synthesis, Utterance }
}

const getJapaneseVoice = (synthesis) => {
  if (typeof synthesis.getVoices !== 'function') return null
  return (
    synthesis
      .getVoices()
      .find((voice) => String(voice?.lang || '').toLowerCase().startsWith('ja')) || null
  )
}

const useJapaneseSpeech = () => {
  const isSpeaking = ref(false)
  const lastError = ref('')
  let playbackId = 0

  const stop = () => {
    playbackId += 1
    const support = getSpeechSupport()
    if (support && typeof support.synthesis.cancel === 'function') {
      support.synthesis.cancel()
    }
    isSpeaking.value = false
  }

  const speak = (text, { lang = 'ja-JP', rate = 0.9, onStart, onEnd, onError } = {}) => {
    const segments = splitSpeechText(text)
    const support = getSpeechSupport()
    if (!support || segments.length === 0) {
      lastError.value = support ? 'empty_text' : 'unsupported'
      onError?.(lastError.value)
      return false
    }

    stop()
    const currentPlaybackId = playbackId
    const voice = getJapaneseVoice(support.synthesis)
    let segmentIndex = 0
    isSpeaking.value = true
    lastError.value = ''
    onStart?.()

    const playNext = () => {
      if (currentPlaybackId !== playbackId) return

      const utterance = new support.Utterance(segments[segmentIndex])
      utterance.lang = lang
      utterance.rate = rate
      if (voice) utterance.voice = voice
      utterance.onend = () => {
        if (currentPlaybackId !== playbackId) return
        segmentIndex += 1
        if (segmentIndex < segments.length) {
          playNext()
          return
        }
        isSpeaking.value = false
        onEnd?.()
      }
      utterance.onerror = () => {
        if (currentPlaybackId !== playbackId) return
        isSpeaking.value = false
        lastError.value = 'playback_failed'
        onError?.(lastError.value)
      }
      support.synthesis.speak(utterance)
    }

    playNext()
    return true
  }

  onBeforeUnmount(stop)

  return { isSpeaking, lastError, speak, stop }
}

export { splitSpeechText, useJapaneseSpeech }
