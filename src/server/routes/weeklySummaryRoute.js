import { parseJsonText } from '../../utils/aiPayloadValidators'
import { createContextSnapshot } from '../contextSnapshot'
import { requestServerLlmText } from '../llmRequest'

const normalizeString = (value) => String(value || '').trim()

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : []

const assertWeeklySummaryPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('weekly summary route requires a JSON object payload')
  }

  const weeklyStats = payload.weekly_stats
  if (!weeklyStats || typeof weeklyStats !== 'object' || Array.isArray(weeklyStats)) {
    throw new Error('weekly summary route requires weekly_stats object')
  }

  return {
    context: createContextSnapshot(payload.context),
    weekly_stats: {
      planned_minutes: Number.isFinite(Number(weeklyStats.planned_minutes))
        ? Number(weeklyStats.planned_minutes)
        : 0,
      completed_minutes: Number.isFinite(Number(weeklyStats.completed_minutes))
        ? Number(weeklyStats.completed_minutes)
        : 0,
      missed_tasks: Number.isFinite(Number(weeklyStats.missed_tasks))
        ? Number(weeklyStats.missed_tasks)
        : 0,
      completed_days: Number.isFinite(Number(weeklyStats.completed_days))
        ? Number(weeklyStats.completed_days)
        : 0,
      total_days: Number.isFinite(Number(weeklyStats.total_days))
        ? Number(weeklyStats.total_days)
        : 7
    }
  }
}

const buildSystemPrompt = () =>
  `
You are an AI Japanese study coach writing a weekly learning review.

Return raw JSON only with this exact shape:
{
  "overview": "short Chinese summary",
  "achievements": ["short point"],
  "risks": ["short point"],
  "next_week_focus": ["short point"],
  "speaking_tasks": ["short speaking task"],
  "listening_tasks": ["short listening task"]
}

Rules:
1. Keep advice actionable and realistic.
2. Use the weekly stats and context snapshot as the only evidence.
3. Prioritize speaking and listening improvements.
4. Do not include markdown fences or extra keys.
`.trim()

const buildUserPrompt = ({ context, weekly_stats }) =>
  `
Context snapshot:
${JSON.stringify(context, null, 2)}

Weekly stats:
${JSON.stringify(weekly_stats, null, 2)}

Generate the weekly summary JSON now.
`.trim()

const normalizeWeeklySummary = (parsed) => {
  const overview = normalizeString(parsed?.overview)
  if (!overview) {
    throw new Error('weekly summary overview is required')
  }

  return {
    overview,
    achievements: normalizeStringArray(parsed?.achievements),
    risks: normalizeStringArray(parsed?.risks),
    next_week_focus: normalizeStringArray(parsed?.next_week_focus),
    speaking_tasks: normalizeStringArray(parsed?.speaking_tasks),
    listening_tasks: normalizeStringArray(parsed?.listening_tasks)
  }
}

const handleWeeklySummary = async (
  payload,
  { requestLlm = requestServerLlmText, providerOptions } = {}
) => {
  const normalizedInput = assertWeeklySummaryPayload(payload)
  const text = await requestLlm({
    taskName: 'summary',
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(normalizedInput),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    },
    providerOptions
  })

  const parsed = parseJsonText(text, 'weekly summary')
  return normalizeWeeklySummary(parsed)
}

export { handleWeeklySummary }
