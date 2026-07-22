import { afterEach, describe, expect, it, vi } from 'vitest'
import { toKanaInput, toKanaInputWithSelection } from '../src/utils/wanakanaInput'

const originalWanakana = window.wanakana

afterEach(() => {
  window.wanakana = originalWanakana
})

describe('wanakanaInput', () => {
  it('keeps plain text unchanged when wanakana is unavailable', () => {
    window.wanakana = undefined

    expect(toKanaInput('nihongo')).toBe('nihongo')
    expect(toKanaInputWithSelection('nihongo', 3, 3)).toEqual({
      value: 'nihongo',
      selectionStart: 3,
      selectionEnd: 3
    })
  })

  it('maps a middle-of-sentence caret through kana conversion', () => {
    window.wanakana = {
      toKana: vi.fn((value) => value.replaceAll('ka', 'か'))
    }

    expect(toKanaInputWithSelection('あkaい', 3, 3)).toEqual({
      value: 'あかい',
      selectionStart: 2,
      selectionEnd: 2
    })
  })

  it('does not let text after the caret commit unfinished romaji', () => {
    window.wanakana = {
      toKana: vi.fn((value) =>
        value
          .replaceAll('na', 'な')
          .replaceAll('ni', 'に')
      )
    }

    expect(toKanaInputWithSelection('あnaka', 2, 2)).toEqual({
      value: 'あnaka',
      selectionStart: 2,
      selectionEnd: 2
    })

    expect(toKanaInputWithSelection('あniaka', 3, 3)).toEqual({
      value: 'あにaka',
      selectionStart: 2,
      selectionEnd: 2
    })
  })

  it('preserves a selected range after conversion', () => {
    window.wanakana = {
      toKana: vi.fn((value) => value.replaceAll('ka', 'か'))
    }

    expect(toKanaInputWithSelection('kaとka', 2, 5)).toEqual({
      value: 'かとか',
      selectionStart: 1,
      selectionEnd: 3
    })
  })
})
