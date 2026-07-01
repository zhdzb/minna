import { describe, expect, it } from 'vitest'
import {
  buildAnswerSummary,
  buildCreateDailyPacketPrompt,
  buildReviewSubmittedPacketPrompt
} from '../src/utils/agentStudyPromptText'

describe('agentStudyPromptText', () => {
  it('builds a Codex-facing create daily packet prompt without frontend generation wording', () => {
    const prompt = buildCreateDailyPacketPrompt()

    expect(prompt).toContain('生成今日学习包')
    expect(prompt).toContain('study/context/next-agent-context.md')
    expect(prompt).toContain('src/data/syllabus.json')
    expect(prompt).toContain('不要调用前端 LLM 出题逻辑')
  })

  it('summarizes submitted answers for the review handoff', () => {
    const summary = buildAnswerSummary({
      exercises: [
        { id: 'exercise-1', prompt: '翻译：我坐公交去。' },
        { id: 'exercise-2', prompt: '对话回复' }
      ],
      answers: {
        'exercise-1': 'バスで 行きます。'
      }
    })

    expect(summary).toContain('バスで 行きます。')
    expect(summary).toContain('未作答')
  })

  it('builds a submitted packet review prompt with file paths and answer summary', () => {
    const prompt = buildReviewSubmittedPacketPrompt({
      indexDocument: {
        latest_daily: 'study/daily/2026-07-01.json'
      },
      dailyPacket: {
        status: 'submitted',
        correction: {
          prompt_file: 'study/prompts/generated/2026-07-01-review.md'
        },
        exercises: [{ id: 'exercise-1', prompt: '第 1 题' }],
        answers: { 'exercise-1': 'わたしは がくせいです。' }
      }
    })

    expect(prompt).toContain('批改已提交学习包')
    expect(prompt).toContain('study/daily/2026-07-01.json')
    expect(prompt).toContain('study/prompts/generated/2026-07-01-review.md')
    expect(prompt).toContain('わたしは がくせいです。')
    expect(prompt).toContain('追加 study/logs/agent-events.jsonl')
  })
})
