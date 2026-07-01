import { parseJsonText, validateGeneratedExercisesPayload } from '../../utils/aiPayloadValidators'
import { requestServerLlmText } from '../llmRequest'

const EXERCISE_TYPE_PROMPTS = {
  ALL: (questionCount) => {
    const fillCount = Math.ceil(questionCount * 0.4)
    const translateCount = Math.ceil(questionCount * 0.4)
    const conversationCount = questionCount - fillCount - translateCount

    return `请总共生成 ${questionCount} 题：
- ${fillCount} 题 q_fill
- ${translateCount} 题 q_translate
- ${conversationCount} 题 q_conversation`
  },
  q_fill: (questionCount) => `只生成 ${questionCount} 题 q_fill。`,
  q_translate: (questionCount) => `只生成 ${questionCount} 题 q_translate。`,
  q_conversation: (questionCount) => `只生成 ${questionCount} 题 q_conversation。`
}

const normalizeString = (value) => String(value || '').trim()

const normalizeVocabulary = (value) => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const text = normalizeString(item)
        return text ? { word: text, kana: '', meaning: '', usage: '' } : null
      }

      if (!item || typeof item !== 'object') return null

      const word = normalizeString(item.word)
      if (!word) return null

      return {
        word,
        kana: normalizeString(item.kana),
        meaning: normalizeString(item.meaning),
        usage: normalizeString(item.usage)
      }
    })
    .filter(Boolean)
}

const normalizeExercisePayload = (payload) => {
  const config = payload?.config && typeof payload.config === 'object' ? payload.config : {}
  const questionCount = Number.isInteger(Number(config.questionCount))
    ? Number(config.questionCount)
    : 10
  const questionType = normalizeString(config.questionType) || 'ALL'

  return {
    lesson: Number.isFinite(Number(payload?.lesson)) ? Number(payload.lesson) : 1,
    lesson_theme: normalizeString(payload?.lesson_theme),
    grammar_points: Array.isArray(payload?.grammar_points)
      ? payload.grammar_points.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    sentence_patterns: Array.isArray(payload?.sentence_patterns)
      ? payload.sentence_patterns.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    hidden_knowledge: Array.isArray(payload?.hidden_knowledge)
      ? payload.hidden_knowledge.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    core_vocabulary: normalizeVocabulary(payload?.core_vocabulary),
    recent_exercises: Array.isArray(payload?.recent_exercises) ? payload.recent_exercises : [],
    config: {
      difficulty: normalizeString(config.difficulty) || 'foundation',
      customPrompt: normalizeString(config.customPrompt),
      questionType: EXERCISE_TYPE_PROMPTS[questionType] ? questionType : 'ALL',
      questionCount: Math.max(1, Math.min(30, questionCount))
    }
  }
}

const assertExercisePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('exercise generation route requires a JSON object payload')
  }

  const normalized = normalizeExercisePayload(payload)
  if (normalized.grammar_points.length === 0) {
    throw new Error('exercise generation route requires non-empty grammar_points')
  }

  return normalized
}

const buildVocabularyLines = (items) => {
  if (!items.length) return ['- 无']

  return items.map((item) => {
    const pieces = [item.word]
    if (item.kana) pieces.push(`读音: ${item.kana}`)
    if (item.meaning) pieces.push(`含义: ${item.meaning}`)
    if (item.usage) pieces.push(`用法: ${item.usage}`)
    return `- ${pieces.join(' | ')}`
  })
}

const buildSystemPrompt = (context) => {
  const lesson = context.lesson
  const grammarPoints = context.grammar_points
  const sentencePatterns = context.sentence_patterns
  const hiddenKnowledge = context.hidden_knowledge
  const vocabulary = context.core_vocabulary
  const recentExercises = context.recent_exercises
  const difficulty = context.config.difficulty
  const customPrompt = context.config.customPrompt
  const questionType = context.config.questionType
  const questionCount = context.config.questionCount
  const questionTypeInstruction =
    EXERCISE_TYPE_PROMPTS[questionType]?.(questionCount) || EXERCISE_TYPE_PROMPTS.ALL(questionCount)

  return `
你正在为中文母语学习者设计《大家的日本语》练习题。输出语言保持为 JSON，但你的内部出题思路必须优先参考下面这些课程信息。

课程范围：
- 当前课次：第 ${lesson} 课
- 本课主题：${context.lesson_theme || '未提供'}
- 难度：${difficulty}
- 额外要求：${customPrompt || '无'}

目标语法（target_grammar 只能从这里选，且必须完全一致）：
${grammarPoints.map((item) => `- ${item}`).join('\n')}

课文里可优先复用的句式骨架：
${sentencePatterns.length ? sentencePatterns.map((item) => `- ${item}`).join('\n') : '- 无'}

出题时要融入的隐藏知识 / 语感提醒：
${hiddenKnowledge.length ? hiddenKnowledge.map((item) => `- ${item}`).join('\n') : '- 无'}

优先复用的课内词汇：
${buildVocabularyLines(vocabulary).join('\n')}

${questionTypeInstruction}

硬性规则：
1. 只返回原始 JSON，不要 markdown，不要解释。
2. 顶层必须是一个对象，且只包含一个键："exercises"。
3. "exercises" 必须是长度恰好为 ${questionCount} 的数组。
4. 每道题都必须有唯一 id。
5. 每道题的 type 必须是 q_fill、q_translate、q_conversation 之一。
6. 每道题的 target_grammar 必须与上面的某一条目标语法完全一致。
7. 不要生成重复题或只是换几个词的近重复题。
8. 优先使用当前课及之前课的词；如必须超纲，放进 vocab_hints 并显式标注。
9. 题目不要总围绕“书、本子、铅笔”这类最简单物品，要结合本课主题、句式和词汇做变化。
10. q_fill 必须包含 question、options、answer；answer 必须出现在 options 中，且只能有一个正确项。
11. q_translate 必须包含 chinese_prompt、vocab_hints，以及 answer 或 answer_pattern。
12. q_conversation 必须包含 scene_description、turns、missing_turn_index、answer。
13. 若出现人名、地名、专有名词，尽量在 vocab_hints 中补读音或中文义。
14. 对话题优先体现礼貌层级、授受方向、条件应对、时间顺序等本课容易错的点。

避免重复使用这些最近已经出过的题：
${recentExercises.length > 0 ? JSON.stringify(recentExercises.slice(0, 15), null, 2) : '[]'}
`.trim()
}

const handleExerciseGeneration = async (
  payload,
  { requestLlm = requestServerLlmText, providerOptions } = {}
) => {
  const normalizedInput = assertExercisePayload(payload)
  const text = await requestLlm({
    taskName: 'exercise',
    systemPrompt: buildSystemPrompt(normalizedInput),
    userPrompt: '请现在返回练习题 payload，只输出合法 JSON。',
    generationConfig: {
      temperature: 0.1,
      topP: 0.7,
      topK: 20,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json'
    },
    providerOptions
  })

  const parsed = parseJsonText(text, 'exercise generation')
  return validateGeneratedExercisesPayload(parsed, {
    expectedGrammarPoints: normalizedInput.grammar_points,
    expectedCount: normalizedInput.config.questionCount
  })
}

export { handleExerciseGeneration }
