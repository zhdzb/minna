import fs from 'fs'
import path from 'path'
import syllabusData from '../../data/syllabus.json'
import { validateDailyPacket, validateCurrent, validateIndex, validateMastery, validateProfile, validateReviewQueue } from '../../utils/agentStudySchema.js'
import { validateDailyPacketContentQuality } from '../../utils/agentStudyContentQuality.js'
import { createAgentStudyEventLog } from './eventLog.js'
import { createAgentStudyContextWriter } from './contextWriter.js'
import { handleExerciseGeneration } from '../routes/exerciseGenerationRoute.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const readJsonFile = (fsImpl, filePath) => JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))

const safeRemoveFile = (fsImpl, filePath) => {
  try {
    fsImpl.unlinkSync(filePath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error
    }
  }
}

const atomicWriteText = (fsImpl, filePath, content) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = filePath + '.tmp'
  fsImpl.writeFileSync(tempPath, content, 'utf8')
  safeRemoveFile(fsImpl, filePath)
  fsImpl.renameSync(tempPath, filePath)
}

const normalizeDate = (timestamp) => String(timestamp || '').slice(0, 10)

const unique = (items) => Array.from(new Set(items.filter(Boolean)))

const toReviewPromptPath = (date) => `study/prompts/generated/${date}-review.md`
const toDailyPath = (date) => `study/daily/${date}.json`
const buildExerciseCountForMinutes = (availableMinutes) =>
  Math.max(3, Math.min(Math.floor(Number(availableMinutes || 0) / 3), 30))

const getLessonById = (lessonId) =>
  Array.isArray(syllabusData.lessons)
    ? syllabusData.lessons.find((lesson) => Number(lesson.id) === Number(lessonId)) || null
    : null

const pickVocabulary = (lesson, limit = 6) => {
  const vocabulary = Array.isArray(lesson?.core_vocabulary) ? lesson.core_vocabulary : []
  return vocabulary.slice(0, limit).map((item) => ({
    word: String(item?.word || '').trim(),
    kana: String(item?.kana || '').trim(),
    meaning: String(item?.meaning || '').trim(),
    usage: String(item?.usage || '').trim()
  })).filter((item) => item.word)
}

const summarizeVocabulary = (items) =>
  items.map((item) => {
    const segments = [item.word]
    if (item.kana) segments.push(`读音：${item.kana}`)
    if (item.meaning) segments.push(`含义：${item.meaning}`)
    if (item.usage) segments.push(`场景：${item.usage}`)
    return segments.join('，')
  })

const QUESTION_TYPE_ORDER = [
  'q_translate',
  'q_translate',
  'q_translate',
  'q_translate',
  'q_translate',
  'q_translate',
  'q_conversation',
  'q_conversation',
  'q_reading',
  'q_listening'
]

const createVocabularyLookup = (items) =>
  new Map(
    items.flatMap((item) => {
      const keys = [item.word, item.kana]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
      return keys.map((key) => [key, item])
    })
  )

const extractVocabularyForText = (text, vocabularyLookup, fallbackItems = [], limit = 3) => {
  const content = String(text || '')
  const matched = []
  const seen = new Set()

  for (const [key, item] of vocabularyLookup.entries()) {
    if (content.includes(key) && !seen.has(item.word)) {
      matched.push(item)
      seen.add(item.word)
    }
  }

  for (const item of fallbackItems) {
    if (matched.length >= limit) break
    if (item?.word && !seen.has(item.word)) {
      matched.push(item)
      seen.add(item.word)
    }
  }

  return matched.slice(0, limit)
}

const buildConversationTurns = ({ lesson, pattern, targetGrammar, vocabulary }) => {
  const vocabA = vocabulary[0]?.word || 'わたし'
  const vocabB = vocabulary[1]?.word || 'がくせい'
  const vocabC = vocabulary[2]?.word || 'にほん'

  if (targetGrammar.includes('N1 の N2')) {
    return [
      { speaker: 'A', content: 'こちらは どなたですか。' },
      { speaker: 'B', content: `わたしの ${vocabB} です。` }
    ]
  }

  if (targetGrammar.includes('じゃありません')) {
    return [
      { speaker: 'A', content: `ミラーさんは ${vocabB} ですか。` },
      { speaker: 'B', content: `${vocabA} は ${vocabB} じゃありません。` }
    ]
  }

  if (targetGrammar.includes('ですか')) {
    return [
      { speaker: 'A', content: `${vocabA} は ${vocabB} ですか。` },
      { speaker: 'B', content: `はい、${vocabA} は ${vocabB} です。` }
    ]
  }

  if (targetGrammar.includes('〜さん')) {
    return [
      { speaker: 'A', content: 'こちらは たなかさんです。' },
      { speaker: 'B', content: 'はじめまして。どうぞ よろしく おねがいします。' }
    ]
  }

  if (targetGrammar.includes('あげます')) {
    return [
      { speaker: 'A', content: `${vocabA} は せんせいに なにを あげましたか。` },
      { speaker: 'B', content: `${vocabA} は せんせいに ${vocabB} を あげました。` }
    ]
  }

  if (targetGrammar.includes('もらいます')) {
    return [
      { speaker: 'A', content: 'その ほんは だれに もらいましたか。' },
      { speaker: 'B', content: `${vocabA} は ともだちに ほんを もらいました。` }
    ]
  }

  if (targetGrammar.includes('なんですか')) {
    return [
      { speaker: 'A', content: `${pattern || 'この ことば'} は にほんごで なんですか。` },
      { speaker: 'B', content: `${vocabC} です。` }
    ]
  }

  return [
    { speaker: 'A', content: sentencePatternsFallback(lesson, pattern) },
    { speaker: 'B', content: `${vocabA} は ${vocabB} です。` }
  ]
}

function sentencePatternsFallback (lesson, pattern) {
  return pattern || `${lesson.title} の 場面です。`
}

const buildFallbackExerciseDraft = ({
  lesson,
  targetGrammar,
  pattern,
  vocabulary,
  vocabularyLookup,
  index
}) => {
  const type = QUESTION_TYPE_ORDER[index % QUESTION_TYPE_ORDER.length]
  const vocabItems = extractVocabularyForText(
    [targetGrammar, pattern, lesson.theme].filter(Boolean).join(' '),
    vocabularyLookup,
    vocabulary.slice(index % Math.max(vocabulary.length, 1)).concat(vocabulary),
    4
  )
  const vocabA = vocabItems[0]?.word || 'わたし'
  const vocabB = vocabItems[1]?.word || 'がくせい'
  const vocabC = vocabItems[2]?.word || 'にほん'
  const meaningB = vocabItems[1]?.meaning || '学生'
  const meaningC = vocabItems[2]?.meaning || '日本'
  const sentenceAnswer = targetGrammar.includes('N1 の N2')
    ? `${vocabA} の ${vocabB} です。`
    : targetGrammar.includes('ですか')
      ? `${vocabA} は ${vocabB} ですか。`
      : targetGrammar.includes('じゃありません')
        ? `${vocabA} は ${vocabB} じゃありません。`
        : pattern || `${vocabA} は ${vocabB} です。`

  if (type === 'q_translate') {
    const translationPrompt = targetGrammar.includes('じゃありません')
      ? `把“我不是${meaningB}，我是${meaningC}人”说成自然日语。`
      : targetGrammar.includes('ですか')
        ? `把“你是${meaningB}吗？”说成自然日语。`
        : targetGrammar.includes('N1 の N2')
          ? `把“这是我的${meaningB}”说成自然日语。`
          : `在“${lesson.theme}”场景里，用「${targetGrammar}」完成一句自然表达。`

    return {
      type,
      prompt: `第 ${index + 1} 题：把中文意思说成日语`,
      instruction: translationPrompt,
      context_note: `请至少使用目标句型「${targetGrammar}」，不要只写寒暄语。`,
      answer_format: '写 1 句完整、自然的日语句子。',
      vocab_hints: ['本题不提供日语词形提示，请根据中文语义和本课内容组织表达。'],
      answer_reference: sentenceAnswer,
      metadata: {
        source: 'rule-based',
        difficulty: 'foundation',
        skill: 'output'
      }
    }
  }

  if (type === 'q_reading') {
    return {
      type,
      prompt: `第 ${index + 1} 题：阅读短文并用日语回答`,
      instruction: '阅读下面的日语内容，用一句自然日语写出主要信息。',
      context_note: `短文模拟 JLPT 短文或日本工作生活中的通知。重点理解「${targetGrammar}」在上下文里的意思。`,
      answer_format: '写 1 句完整日语，不要直接整段照抄。',
      supporting_lines: [sentenceAnswer],
      vocab_hints: ['本题不提供答案词形提示，请根据短文理解作答。'],
      answer_reference: sentenceAnswer,
      metadata: {
        source: 'rule-based',
        difficulty: 'foundation',
        skill: 'reading'
      }
    }
  }

  if (type === 'q_listening') {
    return {
      type,
      prompt: `第 ${index + 1} 题：听取内容并用日语回答`,
      instruction: '点击播放，听完后用一句自然日语写出主要信息。',
      context_note: `音频模拟日本工作或生活中的简短说明。重点听清「${targetGrammar}」表达的关系。`,
      answer_format: '写 1 句完整日语；可以重复播放，但不显示原文。',
      supporting_lines: [],
      vocab_hints: ['本题不显示听力原文，请根据音频作答。'],
      answer_reference: sentenceAnswer,
      metadata: {
        source: 'rule-based',
        difficulty: 'foundation',
        skill: 'listening',
        audio_text: sentenceAnswer
      }
    }
  }

  const turns = buildConversationTurns({ lesson, pattern, targetGrammar, vocabulary: vocabItems })
  const supportingLines = [
    `${turns[0]?.speaker || 'A'}：${turns[0]?.content || '（请根据题目作答）'}`,
    'B：（这里由你作答）'
  ]
  const conversationAnswer = turns[1]?.content || `${vocabA} は ${vocabB} です。`

  return {
    type,
    prompt: `第 ${index + 1} 题：根据情境完成你的回应`,
    instruction: `你是对话中的 B。请用「${targetGrammar}」回答一句自然日语。`,
    context_note: `不要自由发挥成长段落；只需要补出当前这一轮回应。场景主题：${lesson.theme}。`,
    answer_format: '只写 B 的一句回答，不要重复 A 的台词。',
    supporting_lines: supportingLines,
    vocab_hints: ['本题不提供日语词形提示，请根据情境和本课内容回答。'],
    answer_reference: conversationAnswer,
    metadata: {
      source: 'rule-based',
      difficulty: 'foundation',
      skill: 'conversation'
    }
  }
}

const buildReviewItems = ({ reviewQueue, mastery, lessonId }) => {
  const dueItems = Array.isArray(reviewQueue?.items)
    ? reviewQueue.items.filter((item) => item.status === 'due').slice(0, 3)
    : []

  return dueItems.map((item) => {
    const masteryPoint = mastery?.grammar_points?.[item.key]
    return {
      review_queue_id: item.id,
      lesson: Number(masteryPoint?.lesson || lessonId),
      skill: item.kind || 'grammar',
      target_grammar: String(masteryPoint?.pattern || item.key || '复习项').trim()
    }
  })
}

const buildFocusGrammar = ({ lesson, current, mastery, reviewItems }) => {
  const lessonGrammar = Array.isArray(lesson?.grammar_points) ? lesson.grammar_points : []
  const recentGrammar = Array.isArray(current?.recent_focus?.grammar) ? current.recent_focus.grammar : []
  const weakGrammar = Object.values(mastery?.grammar_points || {})
    .filter((point) => Number(point.lesson) === Number(lesson?.id))
    .sort((left, right) => left.controlled_output - right.controlled_output)
    .map((point) => point.pattern)
  const reviewGrammar = reviewItems.map((item) => item.target_grammar)

  const merged = unique([...reviewGrammar, ...weakGrammar, ...recentGrammar, ...lessonGrammar])
  return merged.filter((item) => lessonGrammar.includes(item)).slice(0, 3)
}

const buildMissionGoals = ({ lesson, focusGrammar, reviewItems }) => {
  const goals = []
  if (lesson?.theme) {
    goals.push(`围绕“${lesson.theme}”完成本课输入与输出练习`)
  }
  if (focusGrammar.length) {
    goals.push(`重点巩固：${focusGrammar.join('、')}`)
  }
  if (reviewItems.length) {
    goals.push(`优先消化 ${reviewItems.length} 个到期复习点`)
  }
  return goals.slice(0, 3)
}

const buildTasks = ({ availableMinutes, reviewItems }) => {
  const hasDueReview = reviewItems.length > 0
  const baseTasks = [
    {
      id: 'task-lesson-preview',
      type: 'grammar_review',
      title: '浏览本课知识点与例句',
      minutes: 12,
      required: true,
      status: 'pending'
    },
    {
      id: 'task-shadowing',
      type: 'listening_shadowing',
      title: '跟读句型骨架与听力脚本',
      minutes: 12,
      required: true,
      status: 'pending'
    },
    {
      id: 'task-controlled-output',
      type: 'controlled_output',
      title: '完成受控输出练习',
      minutes: 16,
      required: true,
      status: 'pending'
    },
    {
      id: 'task-free-output',
      type: 'free_output',
      title: '完成情境输出并做自我复盘',
      minutes: 12,
      required: true,
      status: 'pending'
    }
  ]

  if (hasDueReview) {
    baseTasks.unshift({
      id: 'task-due-review',
      type: 'review_queue',
      title: '先处理到期复习点',
      minutes: 10,
      required: true,
      status: 'pending'
    })
  }

  let remaining = availableMinutes
  return baseTasks
    .map((task) => {
      const nextMinutes = Math.max(8, Math.min(task.minutes, remaining))
      remaining = Math.max(0, remaining - nextMinutes)
      return {
        ...task,
        minutes: nextMinutes
      }
    })
    .slice(0, availableMinutes >= 50 ? baseTasks.length : Math.max(3, baseTasks.length - 1))
}

const buildStudyMaterials = ({ lesson, focusGrammar, vocabulary }) => {
  const sentencePatterns = Array.isArray(lesson?.sentence_patterns) ? lesson.sentence_patterns : []
  const hiddenKnowledge = Array.isArray(lesson?.hidden_knowledge) ? lesson.hidden_knowledge : []
  const examples = sentencePatterns.slice(0, 2).map((pattern, index) => ({
    ja: pattern,
    zh: `句型骨架 ${index + 1}`,
    note: '优先模仿语序和礼貌层级'
  }))

  const materials = [
    {
      id: `lesson-${lesson.id}-grammar-note`,
      type: 'grammar_note',
      lesson: lesson.id,
      title: `${lesson.title} 核心文法`,
      content: focusGrammar.length
        ? `本轮优先掌握：${focusGrammar.join('、')}`
        : `本轮优先掌握：${(lesson.grammar_points || []).slice(0, 3).join('、')}`,
      examples: examples.length >= 2
        ? examples
        : [
            { ja: `${lesson.title} の 基本文です。`, zh: '本课基础句 1', note: '占位例句' },
            { ja: `${lesson.title} の 応用文です。`, zh: '本课基础句 2', note: '占位例句' }
          ]
    },
    {
      id: `lesson-${lesson.id}-listening-script`,
      type: 'listening_script',
      lesson: lesson.id,
      title: `${lesson.title} 听力脚本`,
      content: sentencePatterns.slice(0, 3).join('\n') || `${lesson.title} 的句型朗读脚本待补充。`,
      examples: [
        {
          ja: sentencePatterns[0] || `${lesson.title} の 例文 です。`,
          zh: '先听整体语气',
          note: '第一遍只抓关键词'
        },
        {
          ja: sentencePatterns[1] || `${lesson.title} の 応用例 です。`,
          zh: '第二遍跟读并模仿停顿',
          note: '第二遍重点跟读'
        }
      ]
    },
    {
      id: `lesson-${lesson.id}-hidden-knowledge`,
      type: 'contrast_note',
      lesson: lesson.id,
      title: `${lesson.title} 易错提醒`,
      content: hiddenKnowledge.slice(0, 3).join('；') || '本课暂无额外语感提醒。',
      examples: [
        {
          ja: sentencePatterns[0] || `${lesson.title} の 例文 です。`,
          zh: hiddenKnowledge[0] || '优先关注本课语感差异',
          note: '避免只背单句不理解场景'
        },
        {
          ja: sentencePatterns[1] || `${lesson.title} の 応用例 です。`,
          zh: hiddenKnowledge[1] || '尝试替换词汇重新说一遍',
          note: '从句型骨架扩展到自己的表达'
        }
      ]
    }
  ]

  if (vocabulary.length) {
    materials.push({
      id: `lesson-${lesson.id}-core-vocabulary`,
      type: 'vocabulary_note',
      lesson: lesson.id,
      title: `${lesson.title} 高频词汇`,
      content: summarizeVocabulary(vocabulary.slice(0, 5)).join('\n'),
      examples: [
        {
          ja: vocabulary[0]?.word || 'ことば',
          zh: vocabulary[0]?.meaning || '词汇',
          note: vocabulary[0]?.usage || '优先纳入输出题'
        },
        {
          ja: vocabulary[1]?.word || 'れい',
          zh: vocabulary[1]?.meaning || '例子',
          note: vocabulary[1]?.usage || '和句型一起使用'
        }
      ]
    })
  }

  return materials
}

const createFallbackGeneratedExercises = ({ lesson, focusGrammar, vocabulary, reviewItems, questionCount }) => {
  const grammar = focusGrammar.length ? focusGrammar : (lesson.grammar_points || []).slice(0, 3)
  const sentencePatterns = Array.isArray(lesson?.sentence_patterns) ? lesson.sentence_patterns : []
  const reviewMap = new Map(reviewItems.map((item) => [item.target_grammar, item.review_queue_id]))
  const vocabularyLookup = createVocabularyLookup(vocabulary)
  const items = []

  for (let index = 0; index < questionCount; index += 1) {
    const targetGrammar = grammar[index % Math.max(grammar.length, 1)] || `${lesson.title} 重点文法`
    const pattern = sentencePatterns[index % Math.max(sentencePatterns.length, 1)] || `${lesson.title} の 例文です。`
    const draft = buildFallbackExerciseDraft({
      lesson,
      targetGrammar,
      pattern,
      vocabulary,
      vocabularyLookup,
      index
    })
    items.push({
      id: `generated-${lesson.id}-${index + 1}`,
      type: draft.type,
      lesson: lesson.id,
      target_grammar: targetGrammar,
      prompt: draft.prompt,
      instruction: draft.instruction,
      context_note: draft.context_note,
      answer_format: draft.answer_format,
      choices: draft.choices || [],
      supporting_lines: draft.supporting_lines || [],
      vocab_hints: draft.vocab_hints,
      answer_reference: draft.answer_reference,
      metadata: draft.metadata,
      ...(reviewMap.has(targetGrammar) ? { review_queue_id: reviewMap.get(targetGrammar) } : {})
    })
  }

  return items
}

const toDailyExercises = ({ generatedExercises, lesson, reviewItems }) => {
  const reviewMap = new Map(reviewItems.map((item) => [item.target_grammar, item.review_queue_id]))
  return generatedExercises.map((exercise, index) => ({
    id: exercise.id || `exercise-${lesson.id}-${index + 1}`,
    type: exercise.type,
    lesson: lesson.id,
    target_grammar: exercise.target_grammar,
    prompt:
      normalizeExercisePrompt(exercise, index),
    instruction: normalizeExerciseInstruction(exercise),
    context_note: normalizeExerciseContext(exercise),
    answer_format: normalizeExerciseAnswerFormat(exercise),
    choices: Array.isArray(exercise.options)
      ? exercise.options.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    supporting_lines: normalizeExerciseSupportingLines(exercise),
    vocab_hints: Array.isArray(exercise.vocab_hints)
      ? exercise.vocab_hints.map((item) =>
          typeof item === 'string' ? item : [item.word, item.kana, item.cn].filter(Boolean).join(' / ')
        )
      : [],
    answer_reference:
      exercise.answer_reference ||
      exercise.answer ||
      exercise.answer_pattern ||
      (Array.isArray(exercise.turns)
        ? `${exercise.turns.map((turn) => `${turn.speaker}: ${turn.content || '...'}`).join(' / ')} -> ${exercise.answer || ''}`
        : `请围绕「${exercise.target_grammar}」完成表达`),
    metadata: {
      source: 'llm',
      difficulty: 'foundation',
      skill:
        exercise.type === 'q_translate'
          ? 'output'
          : exercise.type === 'q_conversation'
            ? 'conversation'
            : exercise.type === 'q_reading'
              ? 'reading'
              : 'listening',
      ...(exercise.type === 'q_listening' ? { audio_text: exercise.audio_script } : {})
    },
    ...(reviewMap.has(exercise.target_grammar)
      ? { review_queue_id: reviewMap.get(exercise.target_grammar) }
      : {})
  }))
}

const normalizeExercisePrompt = (exercise, index) => {
  if (exercise.type === 'q_translate') return `第 ${index + 1} 题：把中文意思说成日语`
  if (exercise.type === 'q_reading') return `第 ${index + 1} 题：阅读短文并用日语回答`
  if (exercise.type === 'q_listening') return `第 ${index + 1} 题：听取内容并用日语回答`
  return `第 ${index + 1} 题：根据情境完成你的回应`
}

const normalizeExerciseInstruction = (exercise) => {
  if (exercise.type === 'q_translate') {
    return exercise.chinese_prompt || exercise.prompt || `请用日语表达本课句意`
  }
  if (exercise.type === 'q_reading' || exercise.type === 'q_listening') {
    return exercise.question || exercise.prompt || '请理解内容后用日语回答。'
  }
  return exercise.scene_description || exercise.prompt || `请完成一轮情境对话`
}

const normalizeExerciseContext = (exercise) => {
  if (exercise.type === 'q_translate') {
    return `请写成完整自然的日语句子，并明确用到「${exercise.target_grammar}」。`
  }
  if (exercise.type === 'q_reading') {
    return `先理解短文，再用自然日语回答；重点识别「${exercise.target_grammar}」在上下文中的作用。`
  }
  if (exercise.type === 'q_listening') {
    return `听力原文不会显示；可重复播放，重点听清「${exercise.target_grammar}」。`
  }
  return '你只需要补当前这一轮的回答，不必续写整段对话。'
}

const normalizeExerciseAnswerFormat = (exercise) => {
  if (exercise.type === 'q_translate') return '写 1 句完整、自然的日语句子。'
  if (exercise.type === 'q_reading') return '根据短文写 1 句自然日语。'
  if (exercise.type === 'q_listening') return '根据播放内容写 1 句自然日语。'
  return '只写你这一轮的回答，1 句即可。'
}

const normalizeExerciseSupportingLines = (exercise) => {
  if (exercise.type === 'q_reading') {
    return [String(exercise.passage || '').trim()].filter(Boolean)
  }
  if (!Array.isArray(exercise.turns)) return []
  return exercise.turns.map((turn, index) => {
    const speaker = String(turn?.speaker || `角色${index + 1}`).trim()
    const content = String(turn?.content || '').trim()
    return `${speaker}：${content || '（此处由你作答）'}`
  })
}

const generateExercises = async ({
  lesson,
  focusGrammar,
  vocabulary,
  questionCount,
  latestDaily,
  requestLlm,
  providerOptions
}) => {
  try {
    const result = await handleExerciseGeneration(
      {
        lesson: lesson.id,
        lesson_theme: lesson.theme,
        grammar_points: focusGrammar.length ? focusGrammar : lesson.grammar_points,
        sentence_patterns: lesson.sentence_patterns,
        hidden_knowledge: lesson.hidden_knowledge,
        core_vocabulary: vocabulary.map((item) => ({
          word: item.word,
          kana: item.kana,
          meaning: item.meaning,
          usage: item.usage
        })),
        recent_exercises: Array.isArray(latestDaily?.exercises)
          ? latestDaily.exercises.map((item) => item.prompt).slice(0, 12)
          : [],
        config: {
          difficulty: 'foundation',
          questionCount,
          questionType: 'ALL',
          customPrompt: '学习者以赴日工作和 JLPT 考级为目标。不要生成填空题；以完整造句为主，并加入职场情境对话、JLPT 风格短文阅读和可播放的听力理解。请使用中文题干说明，日语答案保持自然，尽量覆盖句型骨架、隐藏句式和本课词汇。人物姓名不是考查目标：题面首次出现姓名时必须附假名读音，例如“山田（やまだ）先生”。题干、instruction、context_note、supporting_lines 和 vocab_hints 不得出现参考答案、完整标准回答或可直接拼出答案的日语词组；姓名读音是唯一例外。参考答案只能放在 answer_reference。阅读短文本身可以显示，听力 audio_script 只能保存供播放，不得显示在题面。'
        }
      },
      { requestLlm, providerOptions }
    )

    return result.exercises
  } catch (_error) {
    return null
  }
}

const buildAnswers = (exercises) =>
  exercises.reduce((accumulator, exercise) => {
    accumulator[exercise.id] = ''
    return accumulator
  }, {})

const buildReviewPrompt = ({ date, dailyPath, lesson, focusGrammar, reviewItems }) => [
  `# ${date} 学习包批改提示词`,
  '',
  '你正在为 Codex Study Loop 执行结构化批改。',
  '',
  '## 必读文件',
  `- ${dailyPath}`,
  '- study/state/current.json',
  '- study/state/mastery.json',
  '- study/state/review-queue.json',
  '- study/prompts/templates/review-submitted-packet.md',
  '',
  '## 本轮重点',
  `- 课程：${lesson.title} ${lesson.theme ? `- ${lesson.theme}` : ''}`,
  `- 重点文法：${focusGrammar.join('、') || '请从学习包内读取'}`,
  `- 到期复习项：${reviewItems.length ? reviewItems.map((item) => item.target_grammar).join('、') : '本轮无到期复习项'}`,
  '',
  '## 批改要求',
  '- 输出必须保持结构化 review result。',
  '- 需要写明错因标签、可接受变体、是否建议重做。',
  '- 人名的轻微假名或字形差异不影响语法、语义和指代时，必须判为正确，不得建议重做或写入 mastery 弱点。',
  '- review item 只保存批改证据，不要复制原题数据；页面会通过 exercise_id 关联 daily packet。',
  '- 如果你判断学习者可以推进，请给出明确理由；否则指出下一轮最该补什么。',
  ''
].join('\n')

const buildContextSummary = ({ lesson, focusGrammar, reviewItems, date, dailyPath, promptPath }) => [
  '# 下一次 Agent 上下文',
  '',
  '## 当前学习包',
  `- 日期：${date}`,
  `- 课程：${lesson.title}`,
  `- 主题：${lesson.theme || '未填写'}`,
  `- 重点文法：${focusGrammar.join('、') || '请读取 daily packet'}`,
  `- 到期复习项：${reviewItems.length ? reviewItems.map((item) => item.target_grammar).join('、') : '无'}`,
  `- Daily：${dailyPath}`,
  `- Review Prompt：${promptPath}`,
  '',
  '## 下一步',
  '- 先读取最新 daily packet。',
  '- 如果学习包已提交，则读取 review prompt 并继续批改。',
  '- 不要覆盖历史 daily / review / log 文件。',
  ''
].join('\n')

const createDailyPacketDocument = ({
  date,
  timestamp,
  lesson,
  availableMinutes,
  focusGrammar,
  tasks,
  studyMaterials,
  reviewItems,
  exercises
}) => validateDailyPacketContentQuality(validateDailyPacket({
  schema_version: 1,
  revision: 1,
  updated_at: timestamp,
  id: `daily-${date}`,
  date,
  status: 'planned',
  created_at: timestamp,
  mission: {
    title: `${lesson.title} 学习包`,
    plan_type: 'lesson-foundation',
    available_minutes: availableMinutes,
    focus_lessons: [lesson.id],
    goals: buildMissionGoals({ lesson, focusGrammar, reviewItems })
  },
  tasks,
  study_materials: studyMaterials,
  review_items: reviewItems,
  exercises,
  answers: buildAnswers(exercises),
  self_assessment: {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: '',
    note: ''
  },
  correction: {
    status: 'pending',
    prompt_file: toReviewPromptPath(date),
    review_file: ''
  },
  review_result: null
}))

const createAgentStudyDailyPacketGenerator = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  requestLlm,
  providerOptions
} = {}) => {
  const eventLog = createAgentStudyEventLog({ studyRoot, fsImpl, now })
  const contextWriter = createAgentStudyContextWriter({ studyRoot, fsImpl, now })

  const loadInputs = () => {
    const indexDocument = validateIndex(readJsonFile(fsImpl, path.join(studyRoot, 'index.json')))
    const profile = validateProfile(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'profile.json')))
    const current = validateCurrent(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'current.json')))
    const mastery = validateMastery(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'mastery.json')))
    const reviewQueue = validateReviewQueue(readJsonFile(fsImpl, path.join(studyRoot, 'state', 'review-queue.json')))
    const latestDaily = indexDocument.latest_daily
      ? validateDailyPacket(readJsonFile(fsImpl, path.join(studyRoot, indexDocument.latest_daily.replace(/^study\//, ''))))
      : null

    return {
      indexDocument,
      profile,
      current,
      mastery,
      reviewQueue,
      latestDaily
    }
  }

  const generate = async ({ date = normalizeDate(now()) } = {}) => {
    const timestamp = now()
    const { indexDocument, profile, current, mastery, reviewQueue, latestDaily } = loadInputs()
    const lessonId = Number(current.current_lesson || profile.material_scope?.current_focus_lessons?.[0] || 1)
    const lesson = getLessonById(lessonId)

    if (!lesson) {
      throw new Error(`未找到第 ${lessonId} 课的知识点数据`)
    }

    const dailyPath = toDailyPath(date)
    const dailyAbsolutePath = path.join(studyRoot, 'daily', `${date}.json`)
    if (fsImpl.existsSync(dailyAbsolutePath)) {
      const existingPacket = validateDailyPacket(readJsonFile(fsImpl, dailyAbsolutePath))
      return {
        dailyPacket: existingPacket,
        promptPath: existingPacket.correction.prompt_file,
        reused: true
      }
    }

    const promptPath = toReviewPromptPath(date)
    const promptAbsolutePath = path.join(studyRoot, 'prompts', 'generated', `${date}-review.md`)
    const reviewItems = buildReviewItems({ reviewQueue, mastery, lessonId })
    const focusGrammar = buildFocusGrammar({ lesson, current, mastery, reviewItems })
    const availableMinutes = Number(current.next_recommendation?.minutes || profile.daily_time_budget_minutes || 45)
    const vocabulary = pickVocabulary(lesson, 8)
    const tasks = buildTasks({ availableMinutes, reviewItems })
    const studyMaterials = buildStudyMaterials({ lesson, focusGrammar, vocabulary })
    const exerciseCount = buildExerciseCountForMinutes(availableMinutes)
    const generatedExercises = await generateExercises({
      lesson,
      focusGrammar,
      vocabulary,
      questionCount: exerciseCount,
      latestDaily,
      requestLlm,
      providerOptions
    })
    const exercises = generatedExercises
      ? toDailyExercises({ generatedExercises, lesson, reviewItems })
      : createFallbackGeneratedExercises({
          lesson,
          focusGrammar,
          vocabulary,
          reviewItems,
          questionCount: exerciseCount
        })

    const dailyPacket = createDailyPacketDocument({
      date,
      timestamp,
      lesson,
      availableMinutes,
      focusGrammar,
      tasks,
      studyMaterials,
      reviewItems,
      exercises
    })

    const promptContent = buildReviewPrompt({ date, dailyPath, lesson, focusGrammar, reviewItems })
    const nextContextContent = buildContextSummary({
      lesson,
      focusGrammar,
      reviewItems,
      date,
      dailyPath,
      promptPath
    })

    atomicWriteText(fsImpl, dailyAbsolutePath, JSON.stringify(dailyPacket, null, 2) + '\n')
    atomicWriteText(fsImpl, promptAbsolutePath, promptContent)
    atomicWriteText(
      fsImpl,
      path.join(studyRoot, 'context', 'next-agent-context.md'),
      nextContextContent
    )

    const nextIndex = validateIndex({
      ...clone(indexDocument),
      latest_daily: dailyPath,
      latest_prompt: promptPath,
      revision: indexDocument.revision + 1,
      updated_at: timestamp
    })
    atomicWriteText(
      fsImpl,
      path.join(studyRoot, 'index.json'),
      JSON.stringify(nextIndex, null, 2) + '\n'
    )

    const event = eventLog.appendEvent({
      actor: 'codex',
      event: 'daily_packet_created',
      input_files: unique([
        'study/index.json',
        'study/state/profile.json',
        'study/state/current.json',
        'study/state/mastery.json',
        'study/state/review-queue.json',
        'src/data/syllabus.json',
        indexDocument.latest_daily
      ]),
      output_files: [
        dailyPath,
        promptPath,
        'study/context/next-agent-context.md',
        'study/index.json',
        'study/logs/agent-events.jsonl'
      ],
      summary: `Created ${lesson.title} daily packet for ${date}.`
    })

    contextWriter.writeNextAgentContext()

    return {
      dailyPacket,
      promptPath,
      reused: false,
      event
    }
  }

  return {
    generate
  }
}

export { buildExerciseCountForMinutes, createAgentStudyDailyPacketGenerator }
