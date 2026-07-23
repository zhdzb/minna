const CURRENT_SCHEMA_VERSION = 1
const SUPPORTED_LEGACY_VERSIONS = [0]

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const clone = (value) => JSON.parse(JSON.stringify(value))

const assertPlainObject = (value, label) => {
  if (!isPlainObject(value)) {
    throw new Error(label + ' must be an object')
  }
  return value
}

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(label + ' must be a non-empty string')
  }
  return value.trim()
}

const assertOptionalString = (value, label) => {
  if (value == null) return null
  if (typeof value !== 'string') {
    throw new Error(label + ' must be a string or null')
  }
  return value
}

const normalizeOptionalStringArray = (value, label) => {
  if (value == null) return []
  return normalizeStringArray(value, label)
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') {
    throw new Error(label + ' must be a boolean')
  }
  return value
}

const assertNumber = (value, label) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(label + ' must be a number')
  }
  return value
}

const assertInteger = (value, label) => {
  if (!Number.isInteger(value)) {
    throw new Error(label + ' must be an integer')
  }
  return value
}

const assertArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(label + ' must be an array')
  }
  return value
}

const normalizeStringArray = (value, label) =>
  assertArray(value, label).map((item, index) => assertNonEmptyString(item, label + '[' + index + ']'))

const normalizeVocabularyFeedback = (value, label) => {
  if (value == null) return []

  return assertArray(value, label).map((item, index) => {
    const feedback = assertPlainObject(item, label + '[' + index + ']')
    return {
      dictionary_form: assertNonEmptyString(
        feedback.dictionary_form,
        label + '[' + index + '].dictionary_form'
      ),
      meaning: assertOptionalString(feedback.meaning, label + '[' + index + '].meaning') || ''
    }
  })
}

const validateBaseDocument = (value, label) => {
  const doc = assertPlainObject(clone(value), label)
  const schemaVersion = doc.schema_version

  if (!Number.isInteger(schemaVersion)) {
    throw new Error(label + '.schema_version must be an integer')
  }

  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(label + '.schema_version ' + schemaVersion + ' is not supported')
  }

  doc.revision = assertInteger(doc.revision, label + '.revision')
  if (doc.revision < 1) {
    throw new Error(label + '.revision must be >= 1')
  }

  doc.updated_at = assertNonEmptyString(doc.updated_at, label + '.updated_at')
  return doc
}

const normalizeLegacyProfile = (value) => {
  const legacy = assertPlainObject(clone(value), 'profile')
  if (!SUPPORTED_LEGACY_VERSIONS.includes(legacy.schema_version)) {
    return value
  }

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    revision: legacy.revision,
    updated_at: legacy.updated_at,
    learner_id: legacy.learner_id || 'legacy-profile',
    goals: Array.isArray(legacy.goals) ? legacy.goals : [],
    daily_time_budget_minutes: legacy.daily_time_budget_minutes ?? legacy.time_budget_minutes,
    pace_preference: legacy.pace_preference || 'steady',
    input_preferences: isPlainObject(legacy.input_preferences)
      ? legacy.input_preferences
      : {
          allow_romaji: false,
          prefer_kana_first: true,
          practice_kanji: true,
          ui_language: 'zh-CN'
        },
    material_scope: isPlainObject(legacy.material_scope)
      ? legacy.material_scope
      : {
          series: legacy.series || 'unknown',
          current_focus_lessons: Array.isArray(legacy.focus_lessons) ? legacy.focus_lessons : [],
          allow_new_lessons: Boolean(legacy.allow_new_lessons)
        },
    notes: Array.isArray(legacy.notes) ? legacy.notes : []
  }
}

const validateIndex = (value) => {
  const doc = validateBaseDocument(value, 'index')
  doc.latest_daily = assertOptionalString(doc.latest_daily, 'index.latest_daily')
  doc.latest_prompt = assertOptionalString(doc.latest_prompt, 'index.latest_prompt')
  doc.latest_review = assertOptionalString(doc.latest_review, 'index.latest_review')
  doc.schema_versions = assertPlainObject(doc.schema_versions, 'index.schema_versions')

  for (const [key, version] of Object.entries(doc.schema_versions)) {
    assertInteger(version, 'index.schema_versions.' + key)
  }

  return doc
}

const validateProfile = (value) => {
  const doc = validateBaseDocument(normalizeLegacyProfile(value), 'profile')
  doc.learner_id = assertNonEmptyString(doc.learner_id, 'profile.learner_id')
  doc.goals = normalizeStringArray(doc.goals, 'profile.goals')
  doc.daily_time_budget_minutes = assertInteger(doc.daily_time_budget_minutes, 'profile.daily_time_budget_minutes')
  doc.pace_preference = assertNonEmptyString(doc.pace_preference, 'profile.pace_preference')
  doc.input_preferences = assertPlainObject(doc.input_preferences, 'profile.input_preferences')
  doc.input_preferences.allow_romaji = assertBoolean(doc.input_preferences.allow_romaji, 'profile.input_preferences.allow_romaji')
  doc.input_preferences.prefer_kana_first = assertBoolean(doc.input_preferences.prefer_kana_first, 'profile.input_preferences.prefer_kana_first')
  doc.input_preferences.practice_kanji = assertBoolean(doc.input_preferences.practice_kanji, 'profile.input_preferences.practice_kanji')
  doc.input_preferences.ui_language = assertNonEmptyString(doc.input_preferences.ui_language, 'profile.input_preferences.ui_language')
  doc.material_scope = assertPlainObject(doc.material_scope, 'profile.material_scope')
  doc.material_scope.series = assertNonEmptyString(doc.material_scope.series, 'profile.material_scope.series')
  doc.material_scope.current_focus_lessons = assertArray(doc.material_scope.current_focus_lessons, 'profile.material_scope.current_focus_lessons').map((lesson, index) => assertInteger(lesson, 'profile.material_scope.current_focus_lessons[' + index + ']'))
  doc.material_scope.allow_new_lessons = assertBoolean(doc.material_scope.allow_new_lessons, 'profile.material_scope.allow_new_lessons')
  doc.notes = normalizeStringArray(doc.notes, 'profile.notes')
  return doc
}

const validateCurrent = (value) => {
  const doc = validateBaseDocument(value, 'current')
  doc.current_lesson = assertInteger(doc.current_lesson, 'current.current_lesson')
  doc.learning_mode = assertNonEmptyString(doc.learning_mode, 'current.learning_mode')
  doc.active_goals = normalizeStringArray(doc.active_goals, 'current.active_goals')
  doc.weakness_summary = assertArray(doc.weakness_summary, 'current.weakness_summary').map((item, index) => {
    const weakness = assertPlainObject(item, 'current.weakness_summary[' + index + ']')
    return {
      scope: assertNonEmptyString(weakness.scope, 'current.weakness_summary[' + index + '].scope'),
      key: assertNonEmptyString(weakness.key, 'current.weakness_summary[' + index + '].key'),
      problem: assertNonEmptyString(weakness.problem, 'current.weakness_summary[' + index + '].problem'),
      evidence: normalizeStringArray(weakness.evidence, 'current.weakness_summary[' + index + '].evidence')
    }
  })
  doc.recent_focus = assertPlainObject(doc.recent_focus, 'current.recent_focus')
  doc.recent_focus.grammar = normalizeStringArray(doc.recent_focus.grammar, 'current.recent_focus.grammar')
  doc.recent_focus.listening = normalizeStringArray(doc.recent_focus.listening, 'current.recent_focus.listening')
  doc.recent_focus.speaking = normalizeStringArray(doc.recent_focus.speaking, 'current.recent_focus.speaking')
  doc.next_recommendation = assertPlainObject(doc.next_recommendation, 'current.next_recommendation')
  doc.next_recommendation.date = assertNonEmptyString(doc.next_recommendation.date, 'current.next_recommendation.date')
  doc.next_recommendation.plan_type = assertNonEmptyString(doc.next_recommendation.plan_type, 'current.next_recommendation.plan_type')
  doc.next_recommendation.minutes = assertInteger(doc.next_recommendation.minutes, 'current.next_recommendation.minutes')
  return doc
}

const validateMastery = (value) => {
  const doc = validateBaseDocument(value, 'mastery')
  doc.current_gate = assertNonEmptyString(doc.current_gate, 'mastery.current_gate')
  doc.lesson_states = assertPlainObject(doc.lesson_states, 'mastery.lesson_states')
  for (const [key, lessonState] of Object.entries(doc.lesson_states)) {
    const label = 'mastery.lesson_states.' + key
    const state = assertPlainObject(lessonState, label)
    state.lesson = assertInteger(state.lesson, label + '.lesson')
    state.status = assertNonEmptyString(state.status, label + '.status')
    state.skill_scores = assertPlainObject(state.skill_scores, label + '.skill_scores')
    for (const [skill, score] of Object.entries(state.skill_scores)) {
      assertNumber(score, label + '.skill_scores.' + skill)
    }
    state.last_reviewed_at = assertNonEmptyString(state.last_reviewed_at, label + '.last_reviewed_at')
  }
  doc.grammar_points = assertPlainObject(doc.grammar_points, 'mastery.grammar_points')
  for (const [key, grammarPoint] of Object.entries(doc.grammar_points)) {
    const label = 'mastery.grammar_points.' + key
    const point = assertPlainObject(grammarPoint, label)
    point.lesson = assertInteger(point.lesson, label + '.lesson')
    point.pattern = assertNonEmptyString(point.pattern, label + '.pattern')
    point.status = assertNonEmptyString(point.status, label + '.status')
    point.recognition = assertNumber(point.recognition, label + '.recognition')
    point.controlled_output = assertNumber(point.controlled_output, label + '.controlled_output')
    point.free_output = assertNumber(point.free_output, label + '.free_output')
    point.last_practiced_at = assertNonEmptyString(point.last_practiced_at, label + '.last_practiced_at')
  }
  return doc
}

const validateReviewQueue = (value) => {
  const doc = validateBaseDocument(value, 'reviewQueue')
  doc.items = assertArray(doc.items, 'reviewQueue.items').map((item, index) => {
    const label = 'reviewQueue.items[' + index + ']'
    const queueItem = assertPlainObject(item, label)
    return {
      id: assertNonEmptyString(queueItem.id, label + '.id'),
      kind: assertNonEmptyString(queueItem.kind, label + '.kind'),
      key: assertNonEmptyString(queueItem.key, label + '.key'),
      status: assertNonEmptyString(queueItem.status, label + '.status'),
      due_date: assertNonEmptyString(queueItem.due_date, label + '.due_date'),
      interval_days: assertInteger(queueItem.interval_days, label + '.interval_days'),
      ease: assertNumber(queueItem.ease, label + '.ease'),
      last_result: assertNonEmptyString(queueItem.last_result, label + '.last_result')
    }
  })
  return doc
}

const validatePromotionRules = (value) => {
  const doc = validateBaseDocument(value, 'promotionRules')
  doc.lesson_gate = assertPlainObject(doc.lesson_gate, 'promotionRules.lesson_gate')
  doc.lesson_gate.min_recent_sessions = assertInteger(doc.lesson_gate.min_recent_sessions, 'promotionRules.lesson_gate.min_recent_sessions')
  doc.lesson_gate.min_output_accuracy = assertNumber(doc.lesson_gate.min_output_accuracy, 'promotionRules.lesson_gate.min_output_accuracy')
  doc.lesson_gate.max_repeat_mistakes_per_key_point = assertInteger(doc.lesson_gate.max_repeat_mistakes_per_key_point, 'promotionRules.lesson_gate.max_repeat_mistakes_per_key_point')
  doc.lesson_gate.required_skill_scores = assertPlainObject(doc.lesson_gate.required_skill_scores, 'promotionRules.lesson_gate.required_skill_scores')
  for (const [skill, score] of Object.entries(doc.lesson_gate.required_skill_scores)) {
    assertNumber(score, 'promotionRules.lesson_gate.required_skill_scores.' + skill)
  }
  return doc
}

const validateStudyMaterial = (item, index) => {
  const label = 'dailyPacket.study_materials[' + index + ']'
  const material = assertPlainObject(item, label)
  return {
    id: assertNonEmptyString(material.id, label + '.id'),
    type: assertNonEmptyString(material.type, label + '.type'),
    lesson: assertInteger(material.lesson, label + '.lesson'),
    title: assertNonEmptyString(material.title, label + '.title'),
    content: assertNonEmptyString(material.content, label + '.content'),
    examples: assertArray(material.examples, label + '.examples').map((example, exampleIndex) => {
      const exampleLabel = label + '.examples[' + exampleIndex + ']'
      const exampleValue = assertPlainObject(example, exampleLabel)
      return {
        ja: assertNonEmptyString(exampleValue.ja, exampleLabel + '.ja'),
        zh: assertNonEmptyString(exampleValue.zh, exampleLabel + '.zh'),
        note: assertNonEmptyString(exampleValue.note, exampleLabel + '.note')
      }
    })
  }
}

const validateExercise = (item, index) => {
  const label = 'dailyPacket.exercises[' + index + ']'
  const exercise = assertPlainObject(item, label)
  exercise.id = assertNonEmptyString(exercise.id, label + '.id')
  exercise.type = assertNonEmptyString(exercise.type, label + '.type')
  exercise.lesson = assertInteger(exercise.lesson, label + '.lesson')
  exercise.target_grammar = assertNonEmptyString(exercise.target_grammar, label + '.target_grammar')
  exercise.prompt = assertNonEmptyString(exercise.prompt, label + '.prompt')
  exercise.instruction = assertOptionalString(exercise.instruction, label + '.instruction')
  exercise.context_note = assertOptionalString(exercise.context_note, label + '.context_note')
  exercise.answer_format = assertOptionalString(exercise.answer_format, label + '.answer_format')
  exercise.choices = normalizeOptionalStringArray(exercise.choices, label + '.choices')
  exercise.supporting_lines = normalizeOptionalStringArray(exercise.supporting_lines, label + '.supporting_lines')
  exercise.vocab_hints = assertArray(exercise.vocab_hints, label + '.vocab_hints')
  exercise.answer_reference = assertNonEmptyString(exercise.answer_reference, label + '.answer_reference')
  exercise.metadata = assertPlainObject(exercise.metadata, label + '.metadata')
  exercise.metadata.source = assertNonEmptyString(exercise.metadata.source, label + '.metadata.source')
  exercise.metadata.difficulty = assertNonEmptyString(exercise.metadata.difficulty, label + '.metadata.difficulty')
  exercise.metadata.skill = assertNonEmptyString(exercise.metadata.skill, label + '.metadata.skill')
  return exercise
}

const validateDailyPacket = (value) => {
  const doc = validateBaseDocument(value, 'dailyPacket')
  doc.id = assertNonEmptyString(doc.id, 'dailyPacket.id')
  doc.date = assertNonEmptyString(doc.date, 'dailyPacket.date')
  doc.status = assertNonEmptyString(doc.status, 'dailyPacket.status')
  doc.created_at = assertNonEmptyString(doc.created_at, 'dailyPacket.created_at')
  doc.mission = assertPlainObject(doc.mission, 'dailyPacket.mission')
  doc.mission.title = assertNonEmptyString(doc.mission.title, 'dailyPacket.mission.title')
  doc.mission.plan_type = assertNonEmptyString(doc.mission.plan_type, 'dailyPacket.mission.plan_type')
  doc.mission.available_minutes = assertInteger(doc.mission.available_minutes, 'dailyPacket.mission.available_minutes')
  doc.mission.focus_lessons = assertArray(doc.mission.focus_lessons, 'dailyPacket.mission.focus_lessons').map((lesson, index) => assertInteger(lesson, 'dailyPacket.mission.focus_lessons[' + index + ']'))
  doc.mission.goals = normalizeStringArray(doc.mission.goals, 'dailyPacket.mission.goals')
  doc.tasks = assertArray(doc.tasks, 'dailyPacket.tasks').map((task, index) => {
    const label = 'dailyPacket.tasks[' + index + ']'
    const taskValue = assertPlainObject(task, label)
    return {
      id: assertNonEmptyString(taskValue.id, label + '.id'),
      type: assertNonEmptyString(taskValue.type, label + '.type'),
      title: assertNonEmptyString(taskValue.title, label + '.title'),
      minutes: assertInteger(taskValue.minutes, label + '.minutes'),
      required: assertBoolean(taskValue.required, label + '.required'),
      status: assertNonEmptyString(taskValue.status, label + '.status')
    }
  })
  doc.study_materials = assertArray(doc.study_materials, 'dailyPacket.study_materials').map(validateStudyMaterial)
  doc.review_items = assertArray(doc.review_items, 'dailyPacket.review_items').map((item, index) => {
    const label = 'dailyPacket.review_items[' + index + ']'
    const reviewItem = assertPlainObject(item, label)
    return {
      review_queue_id: assertNonEmptyString(reviewItem.review_queue_id, label + '.review_queue_id'),
      lesson: assertInteger(reviewItem.lesson, label + '.lesson'),
      skill: assertNonEmptyString(reviewItem.skill, label + '.skill'),
      target_grammar: assertNonEmptyString(reviewItem.target_grammar, label + '.target_grammar')
    }
  })
  doc.exercises = assertArray(doc.exercises, 'dailyPacket.exercises').map(validateExercise)
  doc.answers = assertPlainObject(doc.answers, 'dailyPacket.answers')
  doc.self_assessment = assertPlainObject(doc.self_assessment, 'dailyPacket.self_assessment')
  doc.self_assessment.difficulty = doc.self_assessment.difficulty === null ? null : assertNonEmptyString(doc.self_assessment.difficulty, 'dailyPacket.self_assessment.difficulty')
  doc.self_assessment.uncertain_exercise_ids = assertArray(doc.self_assessment.uncertain_exercise_ids, 'dailyPacket.self_assessment.uncertain_exercise_ids').map((id, index) => assertNonEmptyString(id, 'dailyPacket.self_assessment.uncertain_exercise_ids[' + index + ']'))
  doc.self_assessment.confusing_points = normalizeStringArray(doc.self_assessment.confusing_points, 'dailyPacket.self_assessment.confusing_points')
  if (typeof doc.self_assessment.pace !== 'string') {
    throw new Error('dailyPacket.self_assessment.pace must be a string')
  }
  if (typeof doc.self_assessment.note !== 'string') {
    throw new Error('dailyPacket.self_assessment.note must be a string')
  }
  doc.correction = assertPlainObject(doc.correction, 'dailyPacket.correction')
  doc.correction.status = assertNonEmptyString(doc.correction.status, 'dailyPacket.correction.status')
  if (typeof doc.correction.prompt_file !== 'string') {
    throw new Error('dailyPacket.correction.prompt_file must be a string')
  }
  if (typeof doc.correction.review_file !== 'string') {
    throw new Error('dailyPacket.correction.review_file must be a string')
  }
  if (doc.review_result !== null && !isPlainObject(doc.review_result)) {
    throw new Error('dailyPacket.review_result must be null or an object')
  }
  return doc
}

const validateReviewItem = (item, label) => {
  const reviewItem = assertPlainObject(item, label)
  const rubric = reviewItem.rubric == null ? null : assertPlainObject(reviewItem.rubric, label + '.rubric')
  if (rubric) {
    for (const [rubricKey, rubricScore] of Object.entries(rubric)) {
      assertNumber(rubricScore, label + '.rubric.' + rubricKey)
    }
  }

  return {
    exercise_id: assertNonEmptyString(reviewItem.exercise_id, label + '.exercise_id'),
    is_correct: assertBoolean(reviewItem.is_correct, label + '.is_correct'),
    score: assertNumber(reviewItem.score, label + '.score'),
    error_tags: normalizeStringArray(reviewItem.error_tags, label + '.error_tags'),
    target_grammar: assertNonEmptyString(reviewItem.target_grammar, label + '.target_grammar'),
    user_answer: typeof reviewItem.user_answer === 'string' ? reviewItem.user_answer : '',
    correct_answer: assertNonEmptyString(reviewItem.correct_answer, label + '.correct_answer'),
    explanation: assertNonEmptyString(reviewItem.explanation, label + '.explanation'),
    retry_recommended: assertBoolean(reviewItem.retry_recommended, label + '.retry_recommended'),
    rubric,
    confidence: reviewItem.confidence == null ? null : assertNumber(reviewItem.confidence, label + '.confidence'),
    needs_user_input: reviewItem.needs_user_input == null ? false : assertBoolean(reviewItem.needs_user_input, label + '.needs_user_input'),
    acceptable_variants: reviewItem.acceptable_variants == null ? [] : normalizeStringArray(reviewItem.acceptable_variants, label + '.acceptable_variants'),
    vocabulary_feedback: normalizeVocabularyFeedback(
      reviewItem.vocabulary_feedback,
      label + '.vocabulary_feedback'
    ),
    manual_override: reviewItem.manual_override == null ? null : reviewItem.manual_override
  }
}

const validateReviewResult = (value) => {
  const doc = validateBaseDocument(value, 'reviewResult')
  doc.id = assertNonEmptyString(doc.id, 'reviewResult.id')
  doc.daily_id = assertNonEmptyString(doc.daily_id, 'reviewResult.daily_id')
  doc.created_at = assertNonEmptyString(doc.created_at, 'reviewResult.created_at')
  doc.overall = assertPlainObject(doc.overall, 'reviewResult.overall')
  doc.overall.accuracy = assertNumber(doc.overall.accuracy, 'reviewResult.overall.accuracy')
  doc.overall.can_advance = assertBoolean(doc.overall.can_advance, 'reviewResult.overall.can_advance')
  doc.overall.summary = assertNonEmptyString(doc.overall.summary, 'reviewResult.overall.summary')
  doc.overall.next_focus = normalizeStringArray(doc.overall.next_focus, 'reviewResult.overall.next_focus')
  doc.items = assertArray(doc.items, 'reviewResult.items').map((item, index) =>
    validateReviewItem(item, 'reviewResult.items[' + index + ']')
  )
  doc.mastery_updates = assertArray(doc.mastery_updates, 'reviewResult.mastery_updates')
  doc.review_queue_updates = assertArray(doc.review_queue_updates, 'reviewResult.review_queue_updates')
  doc.promotion_decision = assertPlainObject(doc.promotion_decision, 'reviewResult.promotion_decision')
  doc.promotion_decision.can_advance = assertBoolean(doc.promotion_decision.can_advance, 'reviewResult.promotion_decision.can_advance')
  doc.promotion_decision.reason = assertNonEmptyString(doc.promotion_decision.reason, 'reviewResult.promotion_decision.reason')
  return doc
}

const validateMistakeBook = (value) => {
  const doc = validateBaseDocument(value, 'mistakeBook')
  doc.items = assertArray(doc.items, 'mistakeBook.items').map((item, index) => {
    const label = 'mistakeBook.items[' + index + ']'
    const mistake = assertPlainObject(item, label)
    const reviewSnapshot = validateReviewItem(
      mistake.review_snapshot,
      label + '.review_snapshot'
    )
    if (reviewSnapshot.is_correct) {
      throw new Error(label + '.review_snapshot.is_correct must be false')
    }

    return {
      id: assertNonEmptyString(mistake.id, label + '.id'),
      status: assertNonEmptyString(mistake.status, label + '.status'),
      created_at: assertNonEmptyString(mistake.created_at, label + '.created_at'),
      source_daily: assertNonEmptyString(mistake.source_daily, label + '.source_daily'),
      source_review: assertNonEmptyString(mistake.source_review, label + '.source_review'),
      daily_id: assertNonEmptyString(mistake.daily_id, label + '.daily_id'),
      review_id: assertNonEmptyString(mistake.review_id, label + '.review_id'),
      exercise_id: assertNonEmptyString(mistake.exercise_id, label + '.exercise_id'),
      lesson: assertInteger(mistake.lesson, label + '.lesson'),
      target_grammar: assertNonEmptyString(mistake.target_grammar, label + '.target_grammar'),
      exercise_snapshot: validateExercise(mistake.exercise_snapshot, index),
      review_snapshot: reviewSnapshot,
      attempts: assertArray(mistake.attempts, label + '.attempts').map((attempt, attemptIndex) => {
        const attemptLabel = label + '.attempts[' + attemptIndex + ']'
        const attemptValue = assertPlainObject(attempt, attemptLabel)
        return {
          id: assertNonEmptyString(attemptValue.id, attemptLabel + '.id'),
          submitted_at: assertNonEmptyString(
            attemptValue.submitted_at,
            attemptLabel + '.submitted_at'
          ),
          answer: assertNonEmptyString(attemptValue.answer, attemptLabel + '.answer')
        }
      }),
      last_practiced_at:
        mistake.last_practiced_at == null
          ? null
          : assertNonEmptyString(mistake.last_practiced_at, label + '.last_practiced_at')
    }
  })
  return doc
}

const validateReviewDrill = (value) => {
  const doc = validateBaseDocument(value, 'reviewDrill')
  doc.id = assertNonEmptyString(doc.id, 'reviewDrill.id')
  doc.date = assertNonEmptyString(doc.date, 'reviewDrill.date')
  doc.status = assertNonEmptyString(doc.status, 'reviewDrill.status')
  doc.created_at = assertNonEmptyString(doc.created_at, 'reviewDrill.created_at')
  doc.source_review = assertOptionalString(doc.source_review, 'reviewDrill.source_review')
  doc.summary = assertPlainObject(doc.summary, 'reviewDrill.summary')
  doc.summary.title = assertNonEmptyString(doc.summary.title, 'reviewDrill.summary.title')
  doc.summary.focus = normalizeStringArray(doc.summary.focus, 'reviewDrill.summary.focus')
  doc.summary.due_review_queue_ids = assertArray(
    doc.summary.due_review_queue_ids,
    'reviewDrill.summary.due_review_queue_ids'
  ).map((id, index) =>
    assertNonEmptyString(id, 'reviewDrill.summary.due_review_queue_ids[' + index + ']')
  )
  doc.items = assertArray(doc.items, 'reviewDrill.items').map((item, index) => {
    const label = 'reviewDrill.items[' + index + ']'
    const drillItem = assertPlainObject(item, label)
    return {
      id: assertNonEmptyString(drillItem.id, label + '.id'),
      review_queue_id: assertNonEmptyString(drillItem.review_queue_id, label + '.review_queue_id'),
      key: assertNonEmptyString(drillItem.key, label + '.key'),
      lesson: assertInteger(drillItem.lesson, label + '.lesson'),
      target_grammar: assertNonEmptyString(drillItem.target_grammar, label + '.target_grammar'),
      weakness_explanation: assertNonEmptyString(
        drillItem.weakness_explanation,
        label + '.weakness_explanation'
      ),
      error_tags: normalizeStringArray(drillItem.error_tags, label + '.error_tags'),
      original_prompt: assertNonEmptyString(drillItem.original_prompt, label + '.original_prompt'),
      variant_prompt: assertNonEmptyString(drillItem.variant_prompt, label + '.variant_prompt'),
      answer_reference: assertNonEmptyString(drillItem.answer_reference, label + '.answer_reference'),
      user_answer: typeof drillItem.user_answer === 'string' ? drillItem.user_answer : '',
      hint: assertOptionalString(drillItem.hint, label + '.hint'),
      status: assertNonEmptyString(drillItem.status, label + '.status')
    }
  })
  doc.submission = assertPlainObject(doc.submission, 'reviewDrill.submission')
  doc.submission.submitted_at =
    doc.submission.submitted_at === null
      ? null
      : assertNonEmptyString(doc.submission.submitted_at, 'reviewDrill.submission.submitted_at')
  if (typeof doc.submission.note !== 'string') {
    throw new Error('reviewDrill.submission.note must be a string')
  }
  return doc
}

const validators = {
  index: validateIndex,
  profile: validateProfile,
  current: validateCurrent,
  mastery: validateMastery,
  reviewQueue: validateReviewQueue,
  promotionRules: validatePromotionRules,
  dailyPacket: validateDailyPacket,
  reviewResult: validateReviewResult,
  reviewDrill: validateReviewDrill,
  mistakeBook: validateMistakeBook
}

const validateAgentStudyDocument = (type, value) => {
  const validator = validators[type]
  if (!validator) {
    throw new Error('Unsupported agent study document type: ' + type)
  }
  return validator(value)
}

export {
  CURRENT_SCHEMA_VERSION,
  validateAgentStudyDocument,
  validateCurrent,
  validateDailyPacket,
  validateIndex,
  validateMastery,
  validateMistakeBook,
  validateProfile,
  validatePromotionRules,
  validateReviewQueue,
  validateReviewDrill,
  validateReviewResult
}
