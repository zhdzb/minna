const sanitizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []

const sanitizeNumberArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : []

const sanitizePlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const createContextSnapshot = (context = {}) => {
  const weeklySummary = sanitizePlainObject(context.last_7_days_summary)

  return {
    current_stage: typeof context.current_stage === 'string' ? context.current_stage : '',
    target_exam: typeof context.target_exam === 'string' ? context.target_exam : '',
    priority_skills: sanitizeStringArray(context.priority_skills),
    current_lesson: Number.isFinite(Number(context.current_lesson)) ? Number(context.current_lesson) : 1,
    active_review_lessons: sanitizeNumberArray(context.active_review_lessons),
    recent_weak_patterns: sanitizeStringArray(context.recent_weak_patterns),
    last_7_days_summary: {
      planned_minutes: Number.isFinite(Number(weeklySummary.planned_minutes))
        ? Number(weeklySummary.planned_minutes)
        : 0,
      completed_minutes: Number.isFinite(Number(weeklySummary.completed_minutes))
        ? Number(weeklySummary.completed_minutes)
        : 0,
      missed_tasks: Number.isFinite(Number(weeklySummary.missed_tasks))
        ? Number(weeklySummary.missed_tasks)
        : 0
    },
    provider: typeof context.provider === 'string' ? context.provider : '',
    prompt_version: typeof context.prompt_version === 'string' ? context.prompt_version : ''
  }
}

export { createContextSnapshot }
