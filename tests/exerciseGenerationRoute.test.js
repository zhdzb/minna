import { describe, expect, it, vi } from 'vitest'
import { handleExerciseGeneration } from '../src/server/routes/exerciseGenerationRoute'

describe('exerciseGenerationRoute', () => {
  it('returns validated generated exercises and forwards richer lesson context into the prompt', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        exercises: [
          {
            id: 'q1',
            type: 'q_translate',
            target_grammar: '〜ています',
            chinese_prompt: '我现在在吃饭。',
            answer: 'いま、ごはんを たべています。',
            vocab_hints: []
          },
          {
            id: 'q2',
            type: 'q_listening',
            target_grammar: '〜ています',
            audio_script: 'いま、べんきょうしています。',
            question: '说话人现在在做什么？请用日语回答。',
            answer: 'いま、べんきょうしています。',
            vocab_hints: []
          }
        ]
      })
    )

    const result = await handleExerciseGeneration(
      {
        lesson: 22,
        lesson_theme: '修饰句与正在进行的表达',
        grammar_points: ['〜ています'],
        sentence_patterns: ['いま でんわして います。'],
        hidden_knowledge: ['注意进行体和状态体的区别。'],
        core_vocabulary: [
          { word: 'でんわします', kana: 'でんわします', meaning: '打电话', usage: '正在进行' }
        ],
        config: { questionType: 'ALL', questionCount: 2 }
      },
      { requestLlm }
    )

    expect(result.exercises).toHaveLength(2)
    expect(requestLlm).toHaveBeenCalledTimes(1)
    expect(requestLlm.mock.calls[0][0].taskName).toBe('exercise')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('修饰句与正在进行的表达')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('いま でんわして います。')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('でんわします')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('不要生成填空题')
    expect(requestLlm.mock.calls[0][0].systemPrompt).toContain('q_listening')
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

  it('rejects generated fill-in questions', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        exercises: [
          {
            id: 'q1',
            type: 'q_fill',
            target_grammar: '〜ています',
            question: 'いま、わたしは ____。',
            options: ['たべています', 'たべます'],
            answer: 'たべています'
          }
        ]
      })
    )

    await expect(
      handleExerciseGeneration(
        {
          lesson: 22,
          grammar_points: ['〜ています'],
          config: { questionType: 'ALL', questionCount: 1 }
        },
        { requestLlm }
      )
    ).rejects.toThrow(/unsupported type "q_fill"/)
  })
})
