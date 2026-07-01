const STATIC_READ_FILES = [
  'study/index.json',
  'study/context/next-agent-context.md',
  'study/state/profile.json',
  'study/state/current.json',
  'study/state/mastery.json',
  'study/state/review-queue.json',
  'study/state/promotion-rules.json'
]

const buildCreateDailyPacketPrompt = () => [
  '请作为 Codex Study Loop 学习 agent 执行“生成今日学习包”。',
  '',
  '先读取：',
  ...STATIC_READ_FILES.map((file) => `- ${file}`),
  '- src/data/syllabus.json',
  '- study/prompts/templates/create-daily-packet.md',
  '',
  '请根据当前课次、薄弱点、复习队列、时间预算和课纲，生成新的 daily packet。',
  '',
  '写入要求：',
  '- 新建 study/daily/YYYY-MM-DD.json',
  '- 新建或更新 study/prompts/generated/YYYY-MM-DD-review.md',
  '- 更新 study/index.json',
  '- 更新 study/context/next-agent-context.md',
  '- 追加 study/logs/agent-events.jsonl',
  '',
  '约束：',
  '- 不要覆盖历史 daily/review/log',
  '- 不要调用前端 LLM 出题逻辑',
  '- 题目必须用于学习语法、输入和输出，不要让学习者猜题意',
  '- 题干用中文，答案目标用自然日语',
  '- 完成后运行 npm run verify；如果无法运行，说明原因'
].join('\n')

const normalizePath = (value, fallback = '未关联') => {
  const text = String(value || '').trim()
  return text || fallback
}

const buildAnswerSummary = (dailyPacket) => {
  const exercises = Array.isArray(dailyPacket?.exercises) ? dailyPacket.exercises : []
  const answers = dailyPacket?.answers && typeof dailyPacket.answers === 'object'
    ? dailyPacket.answers
    : {}

  if (!exercises.length) return '- 当前 daily packet 没有练习题。'

  return exercises.map((exercise, index) => {
    const answer = String(answers[exercise.id] || '').trim()
    const prompt = String(exercise.prompt || exercise.id || `第 ${index + 1} 题`).trim()
    return `- ${index + 1}. ${prompt}: ${answer || '未作答'}`
  }).join('\n')
}

const buildReviewSubmittedPacketPrompt = ({ dailyPacket, indexDocument } = {}) => {
  const dailyPath = normalizePath(
    indexDocument?.latest_daily,
    dailyPacket?.date ? `study/daily/${dailyPacket.date}.json` : 'study/daily/YYYY-MM-DD.json'
  )
  const promptPath = normalizePath(
    dailyPacket?.correction?.prompt_file || indexDocument?.latest_prompt,
    'study/prompts/generated/YYYY-MM-DD-review.md'
  )

  return [
    '请作为 Codex Study Loop 学习 agent 执行“批改已提交学习包”。',
    '',
    '先读取：',
    ...STATIC_READ_FILES.map((file) => `- ${file}`),
    '- study/prompts/templates/review-submitted-packet.md',
    `- ${dailyPath}`,
    '',
    '当前提交：',
    `- daily packet: ${dailyPath}`,
    `- review prompt: ${promptPath}`,
    `- status: ${dailyPacket?.status || 'submitted'}`,
    '',
    '本次答案摘要：',
    buildAnswerSummary(dailyPacket),
    '',
    '请完成：',
    '- 批改 daily packet 中每一道题',
    '- 写入 study/reviews/YYYY-MM-DD-review.json',
    '- 更新 daily packet 的 correction 状态和 review_file',
    '- 更新 study/state/mastery.json',
    '- 更新 study/state/review-queue.json',
    '- 更新 study/state/current.json',
    '- 更新 study/index.json',
    '- 更新 study/context/next-agent-context.md',
    '- 追加 study/logs/agent-events.jsonl',
    '',
    '批改要求：',
    '- 输出结构必须符合 review result schema',
    '- 每题说明是否正确、错因标签、参考答案、可接受变体、解释和是否建议重做',
    '- mastery 更新必须基于本次 review evidence',
    '- 如果可以推进下一步，写清楚理由；如果不能推进，写清楚下一轮优先练什么',
    '',
    '约束：',
    '- 不要覆盖历史 daily/review/log',
    '- 不要修改无关学习数据',
    '- 完成后运行 npm run verify；如果无法运行，说明原因'
  ].join('\n')
}

export {
  buildAnswerSummary,
  buildCreateDailyPacketPrompt,
  buildReviewSubmittedPacketPrompt
}
