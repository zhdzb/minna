const GENERATED_TYPES = ['q_fill', 'q_translate', 'q_conversation']

const normalizeText = (value) => String(value || '').trim()

const normalizeGrammar = (value) =>
  normalizeText(value)
    .replace(/\s+/g, ' ')
    .toLowerCase()

const stripMarkdownFence = (text) =>
  normalizeText(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

const extractJsonCandidate = (text) => {
  const source = String(text || '')
  const start = source.search(/[\{\[]/)
  if (start === -1) return ''

  let inString = false
  let escaped = false
  const stack = []

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      stack.push(char)
      continue
    }

    if (char === '}' || char === ']') {
      const open = stack[stack.length - 1]
      const matched = (open === '{' && char === '}') || (open === '[' && char === ']')
      if (!matched) return ''
      stack.pop()
      if (stack.length === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return ''
}

const parseJsonText = (text, label) => {
  const normalized = stripMarkdownFence(text)

  try {
    return JSON.parse(normalized)
  } catch (error) {
    const extracted = extractJsonCandidate(normalized)
    if (extracted) {
      try {
        return JSON.parse(extracted)
      } catch (_innerError) {
        // Fall through to the original error message.
      }
    }

    throw new Error(`${label} JSON parse failed: ${error.message}`)
  }
}

const assertNonEmptyString = (value, fieldName) => {
  if (normalizeText(value) === '') {
    throw new Error(`${fieldName} is required`)
  }
  return normalizeText(value)
}

const normalizeVocabHints = (value, index, options = {}) => {
  const allowEmpty = options.allowEmpty !== false

  if (value == null) {
    return allowEmpty ? [] : (() => {
      throw new Error(`exercise ${index + 1}: vocab_hints must be an array`)
    })()
  }

  if (!Array.isArray(value)) {
    throw new Error(`exercise ${index + 1}: vocab_hints must be an array`)
  }

  const hints = value.map((hint, hintIndex) => {
    if (!hint || typeof hint !== 'object') {
      throw new Error(`exercise ${index + 1}: vocab_hints[${hintIndex}] must be an object`)
    }

    return {
      word: assertNonEmptyString(hint.word, `exercise ${index + 1}: vocab_hints[${hintIndex}].word`),
      kana: assertNonEmptyString(hint.kana, `exercise ${index + 1}: vocab_hints[${hintIndex}].kana`),
      cn: assertNonEmptyString(hint.cn, `exercise ${index + 1}: vocab_hints[${hintIndex}].cn`)
    }
  })

  if (!allowEmpty && hints.length === 0) {
    throw new Error(`exercise ${index + 1}: vocab_hints cannot be empty`)
  }

  return hints
}

const validateTargetGrammar = (targetGrammar, expectedGrammarPoints, index) => {
  const normalizedTarget = normalizeGrammar(targetGrammar)
  const matchedGrammar = expectedGrammarPoints.find(
    (item) => normalizeGrammar(item) === normalizedTarget
  )

  if (!matchedGrammar) {
    throw new Error(`exercise ${index + 1}: target_grammar must match one of the configured grammar points`)
  }

  return matchedGrammar
}

const buildQuestionSignature = (exercise) => {
  if (exercise.type === 'q_fill') {
    return `${exercise.type}:${normalizeText(exercise.question)}`
  }

  if (exercise.type === 'q_translate') {
    return `${exercise.type}:${normalizeText(exercise.chinese_prompt)}`
  }

  return `${exercise.type}:${normalizeText(exercise.scene_description)}`
}

const normalizeGeneratedExercise = (exercise, index, expectedGrammarPoints) => {
  if (!exercise || typeof exercise !== 'object') {
    throw new Error(`exercise ${index + 1}: item must be an object`)
  }

  const normalized = {
    id: assertNonEmptyString(exercise.id, `exercise ${index + 1}: id`),
    type: assertNonEmptyString(exercise.type, `exercise ${index + 1}: type`),
    target_grammar: assertNonEmptyString(exercise.target_grammar, `exercise ${index + 1}: target_grammar`)
  }

  if (!GENERATED_TYPES.includes(normalized.type)) {
    throw new Error(`exercise ${index + 1}: unsupported type "${normalized.type}"`)
  }

  normalized.target_grammar = validateTargetGrammar(normalized.target_grammar, expectedGrammarPoints, index)

  if (normalized.type === 'q_fill') {
    normalized.question = assertNonEmptyString(exercise.question, `exercise ${index + 1}: question`)

    if (!Array.isArray(exercise.options) || exercise.options.length < 2) {
      throw new Error(`exercise ${index + 1}: options must contain at least 2 items`)
    }

    normalized.options = exercise.options.map((option, optionIndex) =>
      assertNonEmptyString(option, `exercise ${index + 1}: options[${optionIndex}]`)
    )

    const uniqueOptions = new Set(normalized.options)
    if (uniqueOptions.size !== normalized.options.length) {
      throw new Error(`exercise ${index + 1}: options must be unique`)
    }

    normalized.answer = assertNonEmptyString(exercise.answer, `exercise ${index + 1}: answer`)
    if (!uniqueOptions.has(normalized.answer)) {
      throw new Error(`exercise ${index + 1}: answer must be one of the options`)
    }
  }

  if (normalized.type === 'q_translate') {
    normalized.chinese_prompt = assertNonEmptyString(
      exercise.chinese_prompt,
      `exercise ${index + 1}: chinese_prompt`
    )
    normalized.answer = normalizeText(exercise.answer)
    normalized.answer_pattern = normalizeText(exercise.answer_pattern)

    if (normalized.answer === '' && normalized.answer_pattern === '') {
      throw new Error(`exercise ${index + 1}: answer or answer_pattern is required`)
    }

    normalized.vocab_hints = normalizeVocabHints(exercise.vocab_hints, index, { allowEmpty: true })
  }

  if (normalized.type === 'q_conversation') {
    normalized.scene_description = assertNonEmptyString(
      exercise.scene_description,
      `exercise ${index + 1}: scene_description`
    )
    normalized.answer = assertNonEmptyString(exercise.answer, `exercise ${index + 1}: answer`)

    if (!Array.isArray(exercise.turns) || exercise.turns.length < 2) {
      throw new Error(`exercise ${index + 1}: turns must contain at least 2 items`)
    }

    const missingIndex = Number.isInteger(exercise.missing_turn_index)
      ? exercise.missing_turn_index
      : null

    normalized.turns = exercise.turns.map((turn, turnIndex) => {
      if (!turn || typeof turn !== 'object') {
        throw new Error(`exercise ${index + 1}: turns[${turnIndex}] must be an object`)
      }

      const speaker = assertNonEmptyString(
        turn.speaker,
        `exercise ${index + 1}: turns[${turnIndex}].speaker`
      )

      const content = normalizeText(turn.content)
      if (content === '' && missingIndex !== turnIndex) {
        throw new Error(`exercise ${index + 1}: turns[${turnIndex}].content is required`)
      }

      return {
        speaker,
        content
      }
    })

    if (missingIndex === null) {
      throw new Error(`exercise ${index + 1}: missing_turn_index must be an integer`)
    }

    if (missingIndex < 0 || missingIndex >= normalized.turns.length) {
      throw new Error(`exercise ${index + 1}: missing_turn_index is out of range`)
    }

    normalized.missing_turn_index = missingIndex
    normalized.vocab_hints = normalizeVocabHints(exercise.vocab_hints, index, { allowEmpty: true })
  }

  return normalized
}

export const validateGeneratedExercisesPayload = (payload, options = {}) => {
  const expectedGrammarPoints = Array.isArray(options.expectedGrammarPoints)
    ? options.expectedGrammarPoints
    : []
  const expectedCount = Number.isInteger(options.expectedCount) ? options.expectedCount : null

  if (expectedGrammarPoints.length === 0) {
    throw new Error('expectedGrammarPoints is required for generated exercise validation')
  }

  const parsed = Array.isArray(payload) ? { exercises: payload } : payload
  const exercises = parsed?.exercises

  if (!Array.isArray(exercises)) {
    throw new Error('generated payload must contain an exercises array')
  }

  if (expectedCount !== null && exercises.length !== expectedCount) {
    throw new Error(`generated exercise count mismatch: expected ${expectedCount}, got ${exercises.length}`)
  }

  const normalizedExercises = exercises.map((exercise, index) =>
    normalizeGeneratedExercise(exercise, index, expectedGrammarPoints)
  )

  const ids = normalizedExercises.map((exercise) => exercise.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('generated exercises must use unique ids')
  }

  const signatures = normalizedExercises.map(buildQuestionSignature)
  if (new Set(signatures).size !== signatures.length) {
    throw new Error('generated exercises contain duplicate questions')
  }

  return { exercises: normalizedExercises }
}

const buildFallbackEvaluation = (item, message) => ({
  id: String(item.id),
  is_correct: false,
  error_type: 'Invalid_Evaluation',
  correct_answer: normalizeText(item.reference_answer) || 'No answer provided',
  explanation: message,
  natural_expression: ''
})

export const validateEvaluationPayload = (payload, batchArray) => {
  if (!Array.isArray(batchArray)) {
    throw new Error('batchArray must be an array')
  }

  if (!Array.isArray(payload)) {
    return batchArray.map((item) =>
      buildFallbackEvaluation(item, 'AI returned an invalid evaluation payload.')
    )
  }

  const resultById = new Map()

  for (const [index, item] of payload.entries()) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const id = normalizeText(item.id)
    if (id === '' || resultById.has(id)) {
      continue
    }

    resultById.set(id, {
      id,
      is_correct: typeof item.is_correct === 'boolean' ? item.is_correct : false,
      error_type: normalizeText(item.error_type),
      correct_answer: normalizeText(item.correct_answer),
      explanation: normalizeText(item.explanation) || `AI returned an incomplete evaluation for item ${index + 1}.`,
      natural_expression: normalizeText(item.natural_expression)
    })
  }

  return batchArray.map((item) => {
    const id = String(item.id)
    const matched = resultById.get(id)

    if (!matched) {
      return buildFallbackEvaluation(item, 'AI did not return a result for this item.')
    }

    if (matched.correct_answer === '') {
      return buildFallbackEvaluation(item, matched.explanation)
    }

    return matched
  })
}

export { GENERATED_TYPES, parseJsonText, stripMarkdownFence }
