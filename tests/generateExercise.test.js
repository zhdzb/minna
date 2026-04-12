import { beforeEach, describe, expect, it, vi } from 'vitest'
import GenerateGrammarExerciseSkill from '../src/skills/generateExercise.js'

describe('GenerateGrammarExerciseSkill', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('parses and validates a correct exercise payload', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    exercises: [
                      {
                        id: 'q1',
                        type: 'q_fill',
                        target_grammar: 'A grammar point',
                        question: 'Test question',
                        options: ['A', 'B'],
                        answer: 'A'
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      })
    })

    const skill = new GenerateGrammarExerciseSkill('dummy')
    const result = await skill.generate({
      lesson: 'Lesson 1',
      grammar_points: ['A grammar point'],
      hidden_knowledge: [],
      config: {
        questionCount: 1,
        questionType: 'q_fill'
      }
    })

    expect(result.exercises).toHaveLength(1)
    expect(result.exercises[0].target_grammar).toBe('A grammar point')
  })

  it('rejects invalid exercise payloads before they reach the UI', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    exercises: [
                      {
                        id: 'q1',
                        type: 'q_fill',
                        target_grammar: 'Wrong grammar',
                        question: 'Broken question',
                        options: ['A', 'A'],
                        answer: 'B'
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      })
    })

    const skill = new GenerateGrammarExerciseSkill('dummy')

    await expect(
      skill.generate({
        lesson: 'Lesson 1',
        grammar_points: ['A grammar point'],
        hidden_knowledge: [],
        config: {
          questionCount: 1,
          questionType: 'q_fill'
        }
      })
    ).rejects.toThrow(/target_grammar/i)
  })

  it('accepts empty vocab hints and natural conversation speaker labels', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    exercises: [
                      {
                        id: 'qt-1',
                        type: 'q_translate',
                        target_grammar: 'A grammar point',
                        chinese_prompt: '你可以在这里等。',
                        vocab_hints: [],
                        answer: 'ここで待ってもいいです。'
                      },
                      {
                        id: 'qc-1',
                        type: 'q_conversation',
                        target_grammar: 'B grammar point',
                        scene_description: '测试场景',
                        turns: [
                          { speaker: 'あなた', content: 'ここを____。' },
                          { speaker: '受付', content: 'はい、どうぞ。' }
                        ],
                        missing_turn_index: 0,
                        answer: '使ってもいいですか'
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      })
    })

    const skill = new GenerateGrammarExerciseSkill('dummy')
    const result = await skill.generate({
      lesson: 'Lesson 1',
      grammar_points: ['A grammar point', 'B grammar point'],
      hidden_knowledge: [],
      config: {
        questionCount: 2,
        questionType: 'ALL'
      }
    })

    expect(result.exercises).toHaveLength(2)
    expect(result.exercises[0].vocab_hints).toEqual([])
    expect(result.exercises[1].turns[0].speaker).toBe('あなた')
  })
})
