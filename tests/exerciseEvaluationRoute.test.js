import { describe, expect, it, vi } from 'vitest'
import { handleExerciseEvaluation } from '../src/server/routes/exerciseEvaluationRoute'

describe('exerciseEvaluationRoute', () => {
  it('returns validated evaluation items', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify([
        {
          id: 'q1',
          is_correct: true,
          error_type: '',
          correct_answer: 'いま、べんきょうしています。',
          explanation: '表达正确',
          natural_expression: ''
        }
      ])
    )

    const result = await handleExerciseEvaluation(
      {
        current_lesson: 22,
        batch: [
          {
            id: 'q1',
            type: 'q_translate',
            original_prompt: '我现在在学习。',
            user_answer: 'いま、べんきょうしています。',
            reference_answer: 'いま、べんきょうしています。'
          }
        ]
      },
      { requestLlm }
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('q1')
    expect(requestLlm).toHaveBeenCalledTimes(1)
    expect(requestLlm.mock.calls[0][0].taskName).toBe('evaluation')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('Proper names are not scoring targets')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('full-width/half-width')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('giving/receiving direction')
  })

  it('rejects empty batch payload before calling LLM', async () => {
    const requestLlm = vi.fn()

    await expect(
      handleExerciseEvaluation(
        {
          current_lesson: 22,
          batch: []
        },
        { requestLlm }
      )
    ).rejects.toThrow(/non-empty batch/)

    expect(requestLlm).not.toHaveBeenCalled()
  })
})
