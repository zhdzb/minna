import { parseJsonText, validateEvaluationPayload } from '@/utils/aiPayloadValidators'
import { buildProviderConfig, requestLlmText } from '@/utils/llmProvider'

export default class EvaluateSentenceSkill {
  constructor(providerConfig) {
    if (typeof providerConfig === 'string') {
      this.providerConfig = { provider: 'gemini', apiKey: providerConfig }
    } else {
      this.providerConfig = providerConfig || {}
    }
    this.maxRetries = this.providerConfig.maxRetries || 3
    this.timeoutMs = this.providerConfig.timeoutMs || 120000
    this.batchSize = this.providerConfig.batchSize || 8
  }

  _buildSystemPrompt(currentLesson, batchArray) {
    const tasks = batchArray
      .map(
        (item, index) => `Task ${index + 1}
- id: ${item.id}
- type: ${item.type}
- original_prompt: ${item.original_prompt}
- learner_answer: ${item.user_answer}
- reference_answer: ${item.reference_answer || ''}`
      )
      .join('\n\n')

    return `
You are evaluating Japanese answers written by a Chinese-speaking learner.
Current lesson range: lesson 1 to lesson ${currentLesson}.

Evaluation rules:
1. Be tolerant of romaji input and judge the intended Japanese sentence.
2. If the pronunciation and kana are correct, do not mark the answer wrong only because kanji were omitted.
3. Ignore missing sentence-final punctuation.
4. Prefer short, precise Chinese explanations.
5. Return raw JSON only. No markdown fences.

Return an array of objects in this shape:
[
  {
    "id": "task id",
    "is_correct": true,
    "error_type": "",
    "correct_answer": "standard Japanese answer",
    "explanation": "short Chinese explanation",
    "natural_expression": "optional, more natural expression"
  }
]

You must return exactly one item per task id.

Tasks:
${tasks}
    `.trim()
  }

  async evaluate(currentLesson, batchArray) {
    if (!Array.isArray(batchArray) || batchArray.length === 0) {
      return []
    }

    try {
      const effectiveConfig = buildProviderConfig(this.providerConfig)
      if (!effectiveConfig.apiKey) {
        return validateEvaluationPayload(null, batchArray)
      }

      const resultMap = new Map()
      for (let i = 0; i < batchArray.length; i += this.batchSize) {
        const chunk = batchArray.slice(i, i + this.batchSize)
        try {
          const textResponse = await requestLlmText({
            providerConfig: {
              ...effectiveConfig,
              maxRetries: this.maxRetries,
              timeoutMs: this.timeoutMs
            },
            systemPrompt: this._buildSystemPrompt(currentLesson, chunk),
            userPrompt: 'Evaluate the learner answers now.',
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 16384
            }
          })

          const parsed = parseJsonText(textResponse, 'evaluation')
          const normalized = validateEvaluationPayload(parsed, chunk)
          normalized.forEach((item) => {
            resultMap.set(String(item.id), item)
          })
        } catch (chunkError) {
          console.error('EvaluateSentenceSkill chunk error:', chunkError)
          const fallback = validateEvaluationPayload(null, chunk).map((item) => ({
            ...item,
            error_type: 'Network_Error',
            explanation: `AI鎵规敼澶辫触: ${chunkError.message}`
          }))
          fallback.forEach((item) => {
            resultMap.set(String(item.id), item)
          })
        }
      }

      return batchArray.map((item) => {
        const existing = resultMap.get(String(item.id))
        if (existing) return existing
        const fallback = validateEvaluationPayload(null, [item])[0]
        return {
          ...fallback,
          error_type: 'Network_Error',
          explanation: 'AI鎵规敼澶辫触: no evaluation returned'
        }
      })
    } catch (error) {
      console.error('EvaluateSentenceSkill error:', error)
      return validateEvaluationPayload(null, batchArray).map((item) => ({
        ...item,
        error_type: 'Network_Error',
        explanation: `AI批改失败: ${error.message}`
      }))
    }
  }
}
