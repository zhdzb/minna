import { describe, expect, it } from 'vitest'
import {
  validateDailyPacketContentQuality,
  validateReviewDrillContentQuality
} from '../src/utils/agentStudyContentQuality'
import {
  createSampleDailyPacket,
  createSampleReviewDrill
} from './helpers/agentStudyRuntimeFixtures'

describe('agentStudyContentQuality', () => {
  it('accepts the sample daily packet', () => {
    const dailyPacket = createSampleDailyPacket()
    expect(validateDailyPacketContentQuality(dailyPacket)).toEqual(dailyPacket)
  })

  it('rejects duplicate exercises for the same target grammar', () => {
    const dailyPacket = createSampleDailyPacket()
    dailyPacket.exercises.push({
      ...dailyPacket.exercises[0],
      id: 'ex-duplicate'
    })

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/duplicates another exercise/)
  })

  it('rejects grammar notes that do not include at least 2 examples', () => {
    const dailyPacket = createSampleDailyPacket()
    dailyPacket.study_materials[0].examples = [dailyPacket.study_materials[0].examples[0]]

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/at least 2 examples/)
  })

  it('rejects output exercises without an answer reference or scoring rubric', () => {
    const dailyPacket = createSampleDailyPacket()
    dailyPacket.exercises[1].answer_reference = ''

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/answer_reference or scoring_rubric/)
  })

  it('rejects listening or shadowing tasks when no script material exists', () => {
    const dailyPacket = createSampleDailyPacket()
    dailyPacket.study_materials = dailyPacket.study_materials.filter(
      (item) => item.type !== 'listening_script' && item.type !== 'shadowing_lines'
    )

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/requires listening_script or shadowing_lines/)
  })

  it('requires a hidden playback script for listening exercises', () => {
    const dailyPacket = createSampleDailyPacket()
    dailyPacket.exercises.push({
      id: 'ex-listening',
      type: 'q_listening',
      lesson: 7,
      target_grammar: 'N で V',
      prompt: '听取内容并回答',
      supporting_lines: [],
      answer_reference: 'バスで いきます。',
      metadata: {
        source: 'codex',
        difficulty: 'foundation',
        skill: 'listening',
        audio_text: ''
      }
    })

    expect(() => validateDailyPacketContentQuality(dailyPacket)).toThrow(/metadata.audio_text/)
  })

  it('rejects review drill items that simply repeat the original prompt', () => {
    const reviewDrill = createSampleReviewDrill()
    reviewDrill.items[0].variant_prompt = reviewDrill.items[0].original_prompt

    expect(() => validateReviewDrillContentQuality(reviewDrill)).toThrow(/must differ/)
  })
})
