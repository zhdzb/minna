import { parseJsonText } from '../../utils/aiPayloadValidators'
import { createContextSnapshot } from '../contextSnapshot'
import { requestServerLlmText } from '../llmRequest'

const normalizeString = (value) => String(value || '').trim()

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : []

const normalizeTask = (task, index) => ({
  id: normalizeString(task?.id) || `task-${index + 1}`,
  type: normalizeString(task?.type) || 'study_task',
  title: normalizeString(task?.title) || `Task ${index + 1}`,
  minutes: Number.isFinite(Number(task?.minutes)) ? Number(task.minutes) : 0,
  required: task?.required !== false,
  status: normalizeString(task?.status) || 'pending'
})

const normalizePlanPayload = (plan) => ({
  available_minutes: Number.isFinite(Number(plan?.available_minutes)) ? Number(plan.available_minutes) : 0,
  plan_type: normalizeString(plan?.plan_type),
  focus_lessons: Array.isArray(plan?.focus_lessons)
    ? plan.focus_lessons.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [],
  tasks: Array.isArray(plan?.tasks) ? plan.tasks.map(normalizeTask) : [],
  completion_criteria: normalizeStringArray(plan?.completion_criteria)
})

const assertPlanPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('daily plan route requires a JSON object payload')
  }

  if (!payload.plan || typeof payload.plan !== 'object' || Array.isArray(payload.plan)) {
    throw new Error('daily plan route requires a structured plan object')
  }

  const normalizedPlan = normalizePlanPayload(payload.plan)
  if (normalizedPlan.available_minutes <= 0) {
    throw new Error('daily plan route requires plan.available_minutes > 0')
  }

  if (normalizedPlan.tasks.length === 0) {
    throw new Error('daily plan route requires at least one plan task')
  }

  return {
    plan: normalizedPlan,
    context: createContextSnapshot(payload.context)
  }
}

const buildSystemPrompt = () => `
You are an AI Japanese study coach helping a Chinese-speaking learner follow a daily study mission.

Return raw JSON only with this exact shape:
{
  "summary": "short Chinese summary of today's mission",
  "focus_notes": ["short note"],
  "speaking_prompts": ["one speaking prompt"],
  "listening_prompts": ["one listening prompt"],
  "review_reminders": ["one reminder"]
}

Rules:
1. Keep all text concise and actionable.
2. Align advice with the provided plan type, time budget, and weak points.
3. Prioritize listening and speaking if the context suggests they are important.
4. Do not include markdown fences or extra keys.
5. Each array should contain 2 to 4 items when enough information is available.
`.trim()

const buildUserPrompt = ({ plan, context }) =>
  `
Study context snapshot:
${JSON.stringify(context, null, 2)}

Today's structured plan:
${JSON.stringify(plan, null, 2)}

Generate the mission enhancement JSON now.
`.trim()

const normalizeResponse = (parsed) => {
  const focusNotes = normalizeStringArray(parsed?.focus_notes)
  const speakingPrompts = normalizeStringArray(parsed?.speaking_prompts)
  const listeningPrompts = normalizeStringArray(parsed?.listening_prompts)
  const reviewReminders = normalizeStringArray(parsed?.review_reminders)
  const summary = normalizeString(parsed?.summary)

  if (!summary) {
    throw new Error('daily plan enhancement summary is required')
  }

  return {
    summary,
    focus_notes: focusNotes,
    speaking_prompts: speakingPrompts,
    listening_prompts: listeningPrompts,
    review_reminders: reviewReminders
  }
}

const createFallbackResponse = ({ plan, context }) => {
  const lessonNumbers = plan.focus_lessons?.length ? plan.focus_lessons : [context.current_lesson].filter(Boolean)
  const lessonLabel = lessonNumbers.length ? `第 ${lessonNumbers.join(', ')} 课` : '当前复习课次'
  const requiredTasks = (plan.tasks || []).filter((task) => task.required)
  const topTaskTitles = requiredTasks.slice(0, 3).map((task) => task.title)

  return {
    summary: `今天围绕${lessonLabel}完成核心复习，优先巩固听力和口语相关任务，再回顾近期错误。`,
    focus_notes: [
      `总时长 ${plan.available_minutes} 分钟，先完成必做任务，再处理选做任务。`,
      topTaskTitles.length
        ? `优先顺序：${topTaskTitles.join('、')}`
        : '优先完成语法复习、听力输入和跟读输出三类任务。',
      '每完成一项任务后，用 30 秒口头复述本轮练习的重点。'
    ],
    speaking_prompts: [
      '请用目标语法说 2 到 3 句，概括你今天的学习安排。',
      '请用自己的话总结今天最难的语法点，并各造一个例句。'
    ],
    listening_prompts: [
      '听课文或示例句两遍，记录 3 个关键词，再复述大意。',
      '同一段音频先跟读一遍，再脱离文本复述一遍。'
    ],
    review_reminders: [
      '结束前回看今天的错题，至少修正 1 个表达错误。',
      '把今天最容易混淆的句型加入明天的第一个复习任务。'
    ]
  }
}

const handleDailyPlanEnhancement = async (
  payload,
  { requestLlm = requestServerLlmText, providerOptions } = {}
) => {
  const normalizedInput = assertPlanPayload(payload)

  const text = await requestLlm({
    taskName: 'plan',
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(normalizedInput),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    },
    providerOptions
  })

  try {
    const parsed = parseJsonText(text, 'daily plan enhancement')
    return normalizeResponse(parsed)
  } catch (_error) {
    return createFallbackResponse(normalizedInput)
  }
}

export { handleDailyPlanEnhancement }
