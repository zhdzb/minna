const PLAN_TYPES = {
  FOUNDATION_REVIEW: 'foundation_review',
  NEW_LESSON: 'new_lesson',
  LISTENING_SPEAKING: 'listening_speaking',
  MISTAKE_REVIEW: 'mistake_review',
  WEEKEND_LONG_SESSION: 'weekend_long_session'
}

const TASK_TYPES = {
  GRAMMAR_REVIEW: 'grammar_review',
  LISTENING_DRILL: 'listening_drill',
  SHADOWING: 'shadowing',
  PATTERN_DRILL: 'pattern_drill',
  SCENARIO_SPEAKING: 'scenario_speaking',
  MISTAKE_REVIEW: 'mistake_review',
  NEW_LESSON_PREP: 'new_lesson_prep'
}

const MINUTES_PRESETS = [30, 60, 90, 120]

const normalizeMinutes = (minutes) => {
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric)) return 30
  if (numeric <= 30) return 30
  if (numeric <= 60) return 60
  if (numeric <= 90) return 90
  return 120
}

const createTask = (type, title, minutes, required = true) => ({
  type,
  title,
  minutes,
  required
})

const createFoundationPlan = (minutes, lesson) => ({
  plan_type: PLAN_TYPES.FOUNDATION_REVIEW,
  focus_lessons: [lesson],
  tasks: [
    createTask(TASK_TYPES.GRAMMAR_REVIEW, `Review lesson ${lesson} core grammar`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.PATTERN_DRILL, `Practice lesson ${lesson} pattern substitutions`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.LISTENING_DRILL, `Listen for key phrases from lesson ${lesson}`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.SHADOWING, `Shadow lesson ${lesson} sample lines`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.MISTAKE_REVIEW, 'Review recent mistakes', Math.max(5, minutes - Math.round(minutes * 0.9)))
  ],
  optional_tasks: [createTask(TASK_TYPES.SCENARIO_SPEAKING, `Try one speaking scenario using lesson ${lesson}`, 10, false)]
})

const createNewLessonPlan = (minutes, lesson) => ({
  plan_type: PLAN_TYPES.NEW_LESSON,
  focus_lessons: [lesson],
  tasks: [
    createTask(TASK_TYPES.NEW_LESSON_PREP, `Preview lesson ${lesson} grammar and vocab`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.GRAMMAR_REVIEW, `Review prerequisite patterns for lesson ${lesson}`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.LISTENING_DRILL, `Listen for lesson ${lesson} key expressions`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.PATTERN_DRILL, `Practice lesson ${lesson} target patterns`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.SHADOWING, `Shadow lesson ${lesson} model lines`, Math.max(5, minutes - Math.round(minutes * 0.85)))
  ],
  optional_tasks: [createTask(TASK_TYPES.SCENARIO_SPEAKING, `Use lesson ${lesson} in one speaking scenario`, 10, false)]
})

const createListeningSpeakingPlan = (minutes, lesson) => ({
  plan_type: PLAN_TYPES.LISTENING_SPEAKING,
  focus_lessons: [lesson],
  tasks: [
    createTask(TASK_TYPES.LISTENING_DRILL, `Complete a listening keyword drill for lesson ${lesson}`, Math.max(10, Math.round(minutes * 0.3))),
    createTask(TASK_TYPES.SHADOWING, `Shadow useful lines from lesson ${lesson}`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.SCENARIO_SPEAKING, `Answer one speaking scenario with lesson ${lesson} patterns`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.PATTERN_DRILL, `Reinforce speaking patterns from lesson ${lesson}`, Math.max(5, minutes - Math.round(minutes * 0.8)))
  ],
  optional_tasks: [createTask(TASK_TYPES.MISTAKE_REVIEW, 'Review one related mistake set', 10, false)]
})

const createMistakeReviewPlan = (minutes, lesson) => ({
  plan_type: PLAN_TYPES.MISTAKE_REVIEW,
  focus_lessons: [lesson],
  tasks: [
    createTask(TASK_TYPES.MISTAKE_REVIEW, 'Review recent mistakes', Math.max(10, Math.round(minutes * 0.35))),
    createTask(TASK_TYPES.GRAMMAR_REVIEW, `Revisit weak lesson ${lesson} grammar`, Math.max(10, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.PATTERN_DRILL, `Retry weak patterns from lesson ${lesson}`, Math.max(10, Math.round(minutes * 0.25))),
    createTask(TASK_TYPES.SHADOWING, `Shadow corrected model answers`, Math.max(5, minutes - Math.round(minutes * 0.8)))
  ],
  optional_tasks: [createTask(TASK_TYPES.LISTENING_DRILL, 'Listen once more for weak expressions', 10, false)]
})

const createWeekendPlan = (minutes, lesson) => ({
  plan_type: PLAN_TYPES.WEEKEND_LONG_SESSION,
  focus_lessons: [lesson, Math.max(1, lesson - 1)],
  tasks: [
    createTask(TASK_TYPES.GRAMMAR_REVIEW, `Review lessons ${Math.max(1, lesson - 1)}-${lesson} grammar`, Math.max(20, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.LISTENING_DRILL, `Complete an extended listening drill`, Math.max(20, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.PATTERN_DRILL, `Practice substitution drills across two lessons`, Math.max(20, Math.round(minutes * 0.2))),
    createTask(TASK_TYPES.SHADOWING, `Shadow multiple useful lines`, Math.max(15, Math.round(minutes * 0.15))),
    createTask(TASK_TYPES.SCENARIO_SPEAKING, `Do a longer workplace speaking scenario`, Math.max(15, Math.round(minutes * 0.15))),
    createTask(TASK_TYPES.MISTAKE_REVIEW, 'Close the session with mistake review', Math.max(10, minutes - Math.round(minutes * 0.9)))
  ],
  optional_tasks: [createTask(TASK_TYPES.NEW_LESSON_PREP, `Preview the next lesson after ${lesson}`, 15, false)]
})

const determinePlanType = ({ availableMinutes, foundationRestartEnabled, recentMistakeCount = 0, prioritizeListeningSpeaking = true, isWeekend = false }) => {
  const minutes = normalizeMinutes(availableMinutes)
  if (isWeekend && minutes >= 120) return PLAN_TYPES.WEEKEND_LONG_SESSION
  if (recentMistakeCount >= 5) return PLAN_TYPES.MISTAKE_REVIEW
  if (foundationRestartEnabled && minutes <= 60) return PLAN_TYPES.FOUNDATION_REVIEW
  if (prioritizeListeningSpeaking && minutes >= 90) return PLAN_TYPES.LISTENING_SPEAKING
  return PLAN_TYPES.NEW_LESSON
}

const buildDailyPlanRules = (context = {}) => {
  const minutes = normalizeMinutes(context.availableMinutes)
  const targetLesson = Number.isFinite(Number(context.currentLesson)) ? Number(context.currentLesson) : 1
  const planType = determinePlanType({
    availableMinutes: minutes,
    foundationRestartEnabled: context.foundationRestartEnabled !== false,
    recentMistakeCount: context.recentMistakeCount || 0,
    prioritizeListeningSpeaking: context.prioritizeListeningSpeaking !== false,
    isWeekend: !!context.isWeekend
  })

  const builders = {
    [PLAN_TYPES.FOUNDATION_REVIEW]: createFoundationPlan,
    [PLAN_TYPES.NEW_LESSON]: createNewLessonPlan,
    [PLAN_TYPES.LISTENING_SPEAKING]: createListeningSpeakingPlan,
    [PLAN_TYPES.MISTAKE_REVIEW]: createMistakeReviewPlan,
    [PLAN_TYPES.WEEKEND_LONG_SESSION]: createWeekendPlan
  }

  const result = builders[planType](minutes, targetLesson)

  return {
    available_minutes: minutes,
    ...result
  }
}

export { buildDailyPlanRules, determinePlanType, MINUTES_PRESETS, PLAN_TYPES, TASK_TYPES }
