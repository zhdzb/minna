import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  validateDailyPacketContentQuality,
  validateReviewDrillContentQuality
} from '../src/utils/agentStudyContentQuality'

const readStudyJson = (relativePath) => {
  const fullPath = path.resolve(process.cwd(), relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

describe('agentStudyContentQuality', () => {
  it('accepts the seed daily packet', () => {
    const dailyPacket = readStudyJson('study/daily/2026-06-26.json')
    expect(validateDailyPacketContentQuality(dailyPacket)).toEqual(dailyPacket)
  })

  it('rejects duplicate exercises for the same target grammar', () => {
    const dailyPacket = readStudyJson('study/daily/2026-06-26.json')
    dailyPacket.exercises.push({
      ...dailyPacket.exercises[0],
      id: 'ex-duplicate'
    })

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/duplicates another exercise/)
  })

  it('rejects grammar notes that do not include at least 2 examples', () => {
    const dailyPacket = readStudyJson('study/daily/2026-06-26.json')
    dailyPacket.study_materials[0].examples = [dailyPacket.study_materials[0].examples[0]]

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/at least 2 examples/)
  })

  it('rejects output exercises without an answer reference or scoring rubric', () => {
    const dailyPacket = readStudyJson('study/daily/2026-06-26.json')
    dailyPacket.exercises[1].answer_reference = ''

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/answer_reference or scoring_rubric/)
  })

  it('rejects listening or shadowing tasks when no script material exists', () => {
    const dailyPacket = readStudyJson('study/daily/2026-06-26.json')
    dailyPacket.study_materials = dailyPacket.study_materials.filter(
      (item) => item.type !== 'listening_script' && item.type !== 'shadowing_lines'
    )

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/requires listening_script or shadowing_lines/)
  })

  it('rejects review drill items that simply repeat the original prompt', () => {
    const reviewDrill = {
      items: [
        {
          original_prompt: 'Translate this sentence.',
          variant_prompt: 'Translate this sentence.'
        }
      ]
    }

    expect(() => validateReviewDrillContentQuality(reviewDrill)).toThrow(/must differ/)
  })
})
