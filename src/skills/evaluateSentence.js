import { parseJsonText, validateEvaluationPayload } from '@/utils/aiPayloadValidators'

export default class EvaluateSentenceSkill {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    this.maxRetries = 3
    this.timeoutMs = 120000
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

  async _fetchWithTimeout(url, options) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async _fetchWithRetry(url, options) {
    let lastError

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        return await this._fetchWithTimeout(url, options)
      } catch (error) {
        lastError = error

        if (error.name === 'AbortError') {
          throw new Error(`API request timed out after ${this.timeoutMs}ms`)
        }

        if (attempt < this.maxRetries - 1) {
          const delay = 1000 * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  _extractTextResponse(data) {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || text.trim() === '') {
      throw new Error('API returned an empty response body')
    }

    return text
  }

  async evaluate(currentLesson, batchArray) {
    if (!Array.isArray(batchArray) || batchArray.length === 0) {
      return []
    }

    if (!this.apiKey) {
      return validateEvaluationPayload(null, batchArray)
    }

    try {
      const response = await this._fetchWithRetry(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Evaluate the learner answers now.' }]
            }
          ],
          systemInstruction: {
            parts: [{ text: this._buildSystemPrompt(currentLesson, batchArray) }]
          },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json'
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()
      const parsed = parseJsonText(this._extractTextResponse(data), 'evaluation')

      return validateEvaluationPayload(parsed, batchArray)
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
