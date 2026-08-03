import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitSpeechText, useJapaneseSpeech } from '../src/composables/useJapaneseSpeech'

const SpeechHarness = {
  setup() {
    return useJapaneseSpeech()
  },
  template: '<div />'
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useJapaneseSpeech', () => {
  it('keeps Japanese sentence boundaries for sequential playback', () => {
    expect(splitSpeechText('メールです。でも、返事はまだです。')).toEqual([
      'メールです。',
      'でも、返事はまだです。'
    ])
  })

  it('plays every sentence in order and selects a Japanese voice when available', () => {
    const speak = vi.fn()
    const cancel = vi.fn()
    const voice = { lang: 'ja-JP', name: 'Japanese test voice' }
    class TestUtterance {
      constructor(text) {
        this.text = text
      }
    }
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      getVoices: () => [voice]
    })
    vi.stubGlobal('SpeechSynthesisUtterance', TestUtterance)

    const wrapper = mount(SpeechHarness)
    const onEnd = vi.fn()
    expect(wrapper.vm.speak('メールです。でも、返事はまだです。', { rate: 0.85, onEnd })).toBe(true)

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: 'メールです。',
      lang: 'ja-JP',
      rate: 0.85,
      voice
    })

    speak.mock.calls[0][0].onend()
    expect(speak).toHaveBeenCalledTimes(2)
    expect(speak.mock.calls[1][0].text).toBe('でも、返事はまだです。')

    speak.mock.calls[1][0].onend()
    expect(wrapper.vm.isSpeaking).toBe(false)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('reports unsupported browsers without attempting playback', () => {
    const wrapper = mount(SpeechHarness)
    const onError = vi.fn()

    expect(wrapper.vm.speak('テストです。', { onError })).toBe(false)
    expect(wrapper.vm.lastError).toBe('unsupported')
    expect(onError).toHaveBeenCalledWith('unsupported')
  })
})
