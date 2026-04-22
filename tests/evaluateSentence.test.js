import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluateSentenceSkill from '../src/skills/evaluateSentence.js'

describe('EvaluateSentenceSkill', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('maps valid evaluation results back to the submitted items', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 'q1',
                      is_correct: true,
                      error_type: '',
                      correct_answer: 'わたしは いきます。',
                      explanation: '表达正确。',
                      natural_expression: 'わたしは いきます。'
                    }
                  ])
                }
              ]
            }
          }
        ]
      })
    })

    const skill = new EvaluateSentenceSkill('dummy')
    const result = await skill.evaluate(1, [
      {
        id: 'q1',
        original_prompt: '请造句',
        user_answer: 'watashi wa ikimasu',
        type: 'q_translate',
        reference_answer: 'わたしは いきます。'
      }
    ])

    expect(result).toHaveLength(1)
    expect(result[0].is_correct).toBe(true)
    expect(result[0].correct_answer).toBe('わたしは いきます。')
  })

  it('creates fallback results when the AI payload is incomplete', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([])
                }
              ]
            }
          }
        ]
      })
    })

    const skill = new EvaluateSentenceSkill('dummy')
    const result = await skill.evaluate(1, [
      {
        id: 'q1',
        original_prompt: '请造句',
        user_answer: '',
        type: 'q_translate',
        reference_answer: 'わたしは いきます。'
      }
    ])

    expect(result).toHaveLength(1)
    expect(result[0].is_correct).toBe(false)
    expect(result[0].correct_answer).toBe('わたしは いきます。')
    expect(result[0].explanation).toMatch(/did not return/i)
  })

  it('parses OpenAI Responses output payload', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify([
                  {
                    id: 'q1',
                    is_correct: true,
                    error_type: '',
                    correct_answer: 'わたしは いきます。',
                    explanation: '表达正确。',
                    natural_expression: ''
                  }
                ])
              }
            ]
          }
        ]
      })
    })

    const skill = new EvaluateSentenceSkill({
      provider: 'openai',
      apiKey: 'dummy_openai',
      openaiModel: 'gpt-5.4',
      openaiBaseUrl: 'https://llmapi.devart.ai',
      openaiReasoningEffort: 'xhigh'
    })

    const result = await skill.evaluate(1, [
      {
        id: 'q1',
        original_prompt: '请造句',
        user_answer: 'watashi wa ikimasu',
        type: 'q_translate',
        reference_answer: 'わたしは いきます。'
      }
    ])

    expect(result).toHaveLength(1)
    expect(result[0].is_correct).toBe(true)
    expect(result[0].correct_answer).toBe('わたしは いきます。')
  })
})
