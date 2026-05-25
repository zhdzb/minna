import { describe, expect, it } from 'vitest'
import { validateBackupPayloadShape } from '../src/utils/backupPayload'

describe('backupPayload', () => {
  it('accepts a complete backup payload shape', () => {
    const payload = {
      progress: { current_lesson: 3 },
      mistakes_book: [],
      daily_plan: {},
      lesson_mastery: {},
      pattern_mastery: {},
      study_backups: []
    }

    expect(validateBackupPayloadShape(payload)).toEqual(payload)
  })

  it('rejects invalid backup payloads', () => {
    expect(() => validateBackupPayloadShape(null)).toThrow(/JSON/)
    expect(() => validateBackupPayloadShape({ progress: {}, mistakes_book: [] })).toThrow(/daily_plan/)
  })
})
