import { parseJsonText, validateEvaluationPayload } from '../../utils/aiPayloadValidators'
import { requestServerLlmText } from '../llmRequest'

const normalizeString = (value) => String(value || '').trim()

const normalizeBatchItem = (item, index) => ({
  id: normalizeString(item?.id) || `item-${index + 1}`,
  type: normalizeString(item?.type) || 'unknown',
  original_prompt: normalizeString(item?.original_prompt),
  user_answer: normalizeString(item?.user_answer),
  reference_answer: normalizeString(item?.reference_answer)
})

const assertEvaluationPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('exercise evaluation route requires a JSON object payload')
  }

  const currentLesson = Number.isFinite(Number(payload.current_lesson))
    ? Number(payload.current_lesson)
    : 1

  const batchArray = Array.isArray(payload.batch)
    ? payload.batch.map(normalizeBatchItem).filter((item) => item.original_prompt)
    : []

  if (batchArray.length === 0) {
    throw new Error('exercise evaluation route requires a non-empty batch')
  }

  return { currentLesson, batchArray }
}

const buildSystemPrompt = (currentLesson, batchArray) => {
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
2. If pronunciation and kana are correct, do not mark the answer wrong only because kanji were omitted.
3. Ignore missing sentence-final punctuation.
4. Proper names are not scoring targets. If a person's name has a minor kana, long-vowel, or kanji/kana spelling difference but the referent, grammar, meaning, and communicative intent remain clear, mark the answer correct and mention the name only as a non-scoring note.
5. Ignore equivalent spacing, full-width/half-width, Arabic/Japanese number, and kanji/kana variations.
6. A one-off typo in non-target vocabulary must not make the whole answer wrong when the intended word is uniquely identifiable and meaning is unchanged.
7. Still mark errors that change meaning or comprehension, including particles, conjugation, tense/polarity, giving/receiving direction, key reading/listening information, and required workplace politeness.
8. Prefer short, precise Chinese explanations.
9. Return raw JSON only. No markdown fences.

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

const handleExerciseEvaluation = async (
  payload,
  { requestLlm = requestServerLlmText, providerOptions } = {}
) => {
  const { currentLesson, batchArray } = assertEvaluationPayload(payload)

  const text = await requestLlm({
    taskName: 'evaluation',
    systemPrompt: buildSystemPrompt(currentLesson, batchArray),
    userPrompt: 'Evaluate the learner answers now.',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384
    },
    providerOptions
  })

  const parsed = parseJsonText(text, 'evaluation')
  return validateEvaluationPayload(parsed, batchArray)
}

export { handleExerciseEvaluation }
