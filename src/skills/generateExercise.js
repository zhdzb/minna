import { parseJsonText, validateGeneratedExercisesPayload } from '@/utils/aiPayloadValidators'
import { buildProviderConfig, requestLlmText } from '@/utils/llmProvider'

const EXERCISE_TYPE_PROMPTS = {
  ALL: (questionCount) => {
    const fillCount = Math.ceil(questionCount * 0.4)
    const translateCount = Math.ceil(questionCount * 0.4)
    const conversationCount = questionCount - fillCount - translateCount

    return `Generate exactly ${questionCount} exercises in total:
- ${fillCount} q_fill
- ${translateCount} q_translate
- ${conversationCount} q_conversation`
  },
  q_fill: (questionCount) => `Generate exactly ${questionCount} q_fill exercises only.`,
  q_translate: (questionCount) => `Generate exactly ${questionCount} q_translate exercises only.`,
  q_conversation: (questionCount) => `Generate exactly ${questionCount} q_conversation exercises only.`
}

export default class GenerateGrammarExerciseSkill {
  constructor(providerConfig) {
    if (typeof providerConfig === 'string') {
      this.providerConfig = { provider: 'gemini', apiKey: providerConfig }
    } else {
      this.providerConfig = providerConfig || {}
    }
    this.maxRetries = this.providerConfig.maxRetries || 3
    this.timeoutMs = this.providerConfig.timeoutMs || 120000
  }

  _buildSystemPrompt(context) {
    const lesson = context?.lesson || ''
    const grammarPoints = Array.isArray(context?.grammar_points) ? context.grammar_points : []
    const hiddenKnowledge = Array.isArray(context?.hidden_knowledge) ? context.hidden_knowledge : []
    const recentExercises = Array.isArray(context?.recent_exercises) ? context.recent_exercises : []
    const difficulty = context?.config?.difficulty || '基础巩固'
    const customPrompt = context?.config?.customPrompt || ''
    const questionType = context?.config?.questionType || 'ALL'
    const questionCount = context?.config?.questionCount || 10
    const questionTypeInstruction =
      EXERCISE_TYPE_PROMPTS[questionType]?.(questionCount) || EXERCISE_TYPE_PROMPTS.ALL(questionCount)

    return `
You are designing Japanese practice material for a Chinese-speaking learner using Minna no Nihongo.

Course scope:
- Current lesson: ${lesson}
- Difficulty: ${difficulty}
- Custom focus: ${customPrompt || 'none'}

You must only use the following grammar points as target_grammar values:
${grammarPoints.map((item) => `- ${item}`).join('\n')}

Blend in these hidden learning hints when appropriate:
${hiddenKnowledge.map((item) => `- ${item}`).join('\n') || '- none'}

${questionTypeInstruction}

Hard rules:
1. Return raw JSON only. No markdown fences.
2. The payload must be an object with one key: "exercises".
3. The "exercises" value must be an array with exactly ${questionCount} items.
4. Every exercise must have a unique "id".
5. Every exercise must have a "type" equal to q_fill, q_translate, or q_conversation.
6. Every exercise must have a "target_grammar" that exactly matches one item from the grammar list above.
7. Do not generate duplicate questions or near-duplicates.
8. Keep vocabulary within the current lesson and earlier lessons. If a word is outside scope, include it in vocab_hints.
9. q_fill must include question, options, and answer. The answer must appear in options and there must be only one correct option.
10. q_translate must include chinese_prompt, vocab_hints, and either answer or answer_pattern.
11. q_conversation must include scene_description, turns, missing_turn_index, and answer.
12. If a Japanese person name or place name appears, include it in vocab_hints with kana and Chinese meaning.

JSON shape reference:
{
  "exercises": [
    {
      "id": "unique-id",
      "type": "q_fill",
      "target_grammar": "${grammarPoints[0] || 'grammar point'}",
      "question": "...",
      "options": ["...", "..."],
      "answer": "..."
    },
    {
      "id": "unique-id-2",
      "type": "q_translate",
      "target_grammar": "${grammarPoints[0] || 'grammar point'}",
      "chinese_prompt": "...",
      "vocab_hints": [
        { "word": "...", "kana": "...", "cn": "..." }
      ],
      "answer_pattern": "..."
    },
    {
      "id": "unique-id-3",
      "type": "q_conversation",
      "target_grammar": "${grammarPoints[0] || 'grammar point'}",
      "scene_description": "...",
      "turns": [
        { "speaker": "A", "content": "..." },
        { "speaker": "B", "content": "..." }
      ],
      "missing_turn_index": 1,
      "answer": "..."
    }
  ]
}

Avoid reusing these recent exercises:
${recentExercises.length > 0 ? JSON.stringify(recentExercises.slice(0, 15), null, 2) : '[]'}
    `.trim()
  }

  async generate(context) {
    const systemPrompt = this._buildSystemPrompt(context)
    const expectedGrammarPoints = Array.isArray(context?.grammar_points) ? context.grammar_points : []
    const expectedCount = context?.config?.questionCount || 10

    try {
      const effectiveConfig = buildProviderConfig(this.providerConfig)
      if (!effectiveConfig.apiKey) {
        throw new Error(`${effectiveConfig.provider === 'openai' ? 'OpenAI' : 'Gemini'} API key is missing`)
      }

      const textResponse = await requestLlmText({
        providerConfig: {
          ...effectiveConfig,
          maxRetries: this.maxRetries,
          timeoutMs: this.timeoutMs
        },
        systemPrompt,
        userPrompt: 'Return the exercise payload now. Output valid JSON only.',
        generationConfig: {
          temperature: 0.1,
          topP: 0.7,
          topK: 20,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json'
        }
      })

      const parsed = parseJsonText(textResponse, 'exercise generation')

      return validateGeneratedExercisesPayload(parsed, {
        expectedGrammarPoints,
        expectedCount
      })
    } catch (error) {
      console.error('GenerateGrammarExerciseSkill error:', error)
      throw new Error(`AI generation failed: ${error.message}`)
    }
  }
}
