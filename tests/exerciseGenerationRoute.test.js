import { describe, expect, it, vi } from 'vitest'
import { handleExerciseGeneration } from '../src/server/routes/exerciseGenerationRoute'

describe('exerciseGenerationRoute', () => {
  it('returns validated generated exercises', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        exercises: [
          {
            id: 'q1',
            type: 'q_fill',
            target_grammar: 'ています',
            question: 'いま、わたしは ____。',
            options: ['たべています', 'たべます'],
            answer: 'たべています'
          },
          {
            id: 'q2',
            type: 'q_translate',
            target_grammar: 'ています',
            chinese_prompt: '我现在在学习。',
            answer: 'いま、べんきょうしています。',
            vocab_hints: []
          }
        ]
      })
    )

    const result = await handleExerciseGeneration(
      {
        lesson: 22,
        grammar_points: ['ています'],
        config: { questionType: 'ALL', questionCount: 2 }
      },
      { requestLlm }
    )

    expect(result.exercises).toHaveLength(2)
    expect(requestLlm).toHaveBeenCalledTimes(1)
    expect(requestLlm.mock.calls[0][0].taskName).toBe('exercise')
  })

  it('rejects invalid payload before calling LLM', async () => {
    const requestLlm = vi.fn()

    await expect(
      handleExerciseGeneration(
        {
          lesson: 22,
          grammar_points: []
        },
        { requestLlm }
      )
    ).rejects.toThrow(/grammar_points/)

    expect(requestLlm).not.toHaveBeenCalled()
  })
})
