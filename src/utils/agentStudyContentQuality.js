const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeText = (value) => String(value || '').trim()

const OUTPUT_EXERCISE_TYPES = new Set(['q_translate', 'q_conversation', 'q_pattern_substitution'])
const LISTENING_TASK_TYPES = new Set(['listening_drill', 'listening_shadowing', 'shadowing', 'shadowing_lines'])
const EXAMPLE_REQUIRED_TYPES = new Set(['grammar_note', 'contrast_note'])

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const buildExerciseBudget = (dailyPacket) => {
  const availableMinutes = Number.isInteger(dailyPacket?.mission?.available_minutes)
    ? dailyPacket.mission.available_minutes
    : 0

  return Math.max(3, Math.floor(availableMinutes / 3))
}

const buildReviewQueueIdSet = (dailyPacket) =>
  new Set(
    Array.isArray(dailyPacket.review_items)
      ? dailyPacket.review_items
          .map((item) => normalizeText(item.review_queue_id))
          .filter(Boolean)
      : []
  )

const buildMaterialTypeSet = (dailyPacket) =>
  new Set(
    Array.isArray(dailyPacket.study_materials)
      ? dailyPacket.study_materials
          .map((item) => normalizeText(item.type))
          .filter(Boolean)
      : []
  )

const validateStudyMaterials = (dailyPacket) => {
  const studyMaterials = Array.isArray(dailyPacket.study_materials) ? dailyPacket.study_materials : []

  studyMaterials.forEach((material, index) => {
    const label = 'study_materials[' + index + ']'
    assert(isPlainObject(material), label + ' must be an object')
    const materialType = normalizeText(material.type)

    if (EXAMPLE_REQUIRED_TYPES.has(materialType)) {
      assert(
        Array.isArray(material.examples) && material.examples.length >= 2,
        label + ' must include at least 2 examples'
      )
    }
  })
}

const validateExercises = (dailyPacket) => {
  const exercises = Array.isArray(dailyPacket.exercises) ? dailyPacket.exercises : []
  const reviewQueueIds = buildReviewQueueIdSet(dailyPacket)
  const focusLessons = new Set(
    Array.isArray(dailyPacket?.mission?.focus_lessons) ? dailyPacket.mission.focus_lessons : []
  )
  const seenQuestionSignatures = new Set()
  const exerciseBudget = buildExerciseBudget(dailyPacket)

  assert(
    exercises.length <= exerciseBudget,
    'dailyPacket.exercises exceeds the available daily exercise budget'
  )

  exercises.forEach((exercise, index) => {
    const label = 'exercises[' + index + ']'
    assert(isPlainObject(exercise), label + ' must be an object')

    const lesson = exercise.lesson
    const skill = normalizeText(exercise?.metadata?.skill)
    const targetGrammar = normalizeText(exercise.target_grammar)
    const prompt = normalizeText(exercise.prompt)
    const linkedReviewQueueId = normalizeText(exercise.review_queue_id)

    assert(Number.isInteger(lesson), label + ' must include a lesson number')
    assert(skill !== '', label + ' must include metadata.skill')
    assert(
      targetGrammar !== '' || linkedReviewQueueId !== '',
      label + ' must include target_grammar or review_queue_id'
    )

    if (focusLessons.size > 0) {
      assert(
        focusLessons.has(lesson),
        label + ' lesson must belong to the mission focus lessons'
      )
    }

    if (linkedReviewQueueId !== '') {
      assert(
        reviewQueueIds.has(linkedReviewQueueId),
        label + ' review_queue_id must match one of dailyPacket.review_items'
      )
    }

    const signature = targetGrammar + '::' + prompt
    assert(
      !seenQuestionSignatures.has(signature),
      label + ' duplicates another exercise for the same target grammar'
    )
    seenQuestionSignatures.add(signature)

    if (OUTPUT_EXERCISE_TYPES.has(normalizeText(exercise.type))) {
      assert(
        normalizeText(exercise.answer_reference) !== '' || isPlainObject(exercise.scoring_rubric),
        label + ' must provide answer_reference or scoring_rubric for output exercises'
      )
    }
  })
}

const validateListeningAndShadowingSupport = (dailyPacket) => {
  const tasks = Array.isArray(dailyPacket.tasks) ? dailyPacket.tasks : []
  const materialTypes = buildMaterialTypeSet(dailyPacket)
  const hasListeningScript = materialTypes.has('listening_script')
  const hasShadowingLines = materialTypes.has('shadowing_lines')

  tasks.forEach((task, index) => {
    const taskType = normalizeText(task?.type)
    if (!LISTENING_TASK_TYPES.has(taskType)) {
      return
    }

    const label = 'tasks[' + index + ']'
    assert(
      hasListeningScript || hasShadowingLines,
      label + ' requires listening_script or shadowing_lines study material'
    )
  })
}

const validateDailyPacketContentQuality = (dailyPacket) => {
  assert(isPlainObject(dailyPacket), 'dailyPacket must be an object')

  validateStudyMaterials(dailyPacket)
  validateExercises(dailyPacket)
  validateListeningAndShadowingSupport(dailyPacket)

  return dailyPacket
}

const validateReviewDrillContentQuality = (reviewDrill) => {
  assert(isPlainObject(reviewDrill), 'reviewDrill must be an object')

  const items = Array.isArray(reviewDrill.items) ? reviewDrill.items : []
  items.forEach((item, index) => {
    const label = 'reviewDrill.items[' + index + ']'
    assert(isPlainObject(item), label + ' must be an object')
    assert(
      normalizeText(item.original_prompt) !== normalizeText(item.variant_prompt),
      label + ' variant_prompt must differ from original_prompt'
    )
  })

  return reviewDrill
}

export { validateDailyPacketContentQuality, validateReviewDrillContentQuality }
