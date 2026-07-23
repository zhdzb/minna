const LISTENING_LAB_SCHEMA_VERSION = 1

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const assertObject = (value, label) => {
  if (!isPlainObject(value)) throw new Error(label + ' must be an object')
  return value
}

const assertArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(label + ' must be an array')
  return value
}

const assertString = (value, label, { allowEmpty = false } = {}) => {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new Error(label + ' must be ' + (allowEmpty ? 'a string' : 'a non-empty string'))
  }
  return value
}

const assertNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number')
  }
  return value
}

const assertInteger = (value, label) => {
  if (!Number.isInteger(value)) throw new Error(label + ' must be an integer')
  return value
}

const assertBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(label + ' must be a boolean')
  return value
}

const normalizeStringArray = (value, label) =>
  assertArray(value, label).map((item, index) =>
    assertString(item, label + '[' + index + ']')
  )

const validateBaseDocument = (value, label) => {
  const doc = assertObject(value, label)
  if (assertInteger(doc.schema_version, label + '.schema_version') !== LISTENING_LAB_SCHEMA_VERSION) {
    throw new Error(label + '.schema_version is unsupported')
  }
  assertInteger(doc.revision, label + '.revision')
  assertString(doc.updated_at, label + '.updated_at')
  return doc
}

const validateListeningLabIndex = (value) => {
  const doc = validateBaseDocument(value, 'listeningLabIndex')
  assertString(doc.latest_session, 'listeningLabIndex.latest_session', { allowEmpty: true })
  assertString(doc.latest_attempt, 'listeningLabIndex.latest_attempt', { allowEmpty: true })
  doc.sessions = assertArray(doc.sessions, 'listeningLabIndex.sessions').map((entry, index) => {
    const label = 'listeningLabIndex.sessions[' + index + ']'
    const item = assertObject(entry, label)
    return {
      id: assertString(item.id, label + '.id'),
      date: assertString(item.date, label + '.date'),
      title: assertString(item.title, label + '.title'),
      scenario: assertString(item.scenario, label + '.scenario'),
      status: assertString(item.status, label + '.status'),
      session_file: assertString(item.session_file, label + '.session_file'),
      attempt_file: assertString(item.attempt_file, label + '.attempt_file'),
      accuracy: item.accuracy == null ? null : assertNumber(item.accuracy, label + '.accuracy'),
      updated_at: assertString(item.updated_at, label + '.updated_at')
    }
  })
  return doc
}

const validateListeningSourceSnapshot = (value) => {
  const doc = validateBaseDocument(value, 'listeningSourceSnapshot')
  assertString(doc.id, 'listeningSourceSnapshot.id')
  assertString(doc.generated_at, 'listeningSourceSnapshot.generated_at')
  doc.source_revisions = assertObject(
    doc.source_revisions,
    'listeningSourceSnapshot.source_revisions'
  )
  for (const [key, revision] of Object.entries(doc.source_revisions)) {
    assertInteger(revision, 'listeningSourceSnapshot.source_revisions.' + key)
  }
  assertInteger(doc.current_lesson, 'listeningSourceSnapshot.current_lesson')
  doc.focus_lessons = assertArray(
    doc.focus_lessons,
    'listeningSourceSnapshot.focus_lessons'
  ).map((lesson, index) =>
    assertInteger(lesson, 'listeningSourceSnapshot.focus_lessons[' + index + ']')
  )
  assertString(doc.level_hint, 'listeningSourceSnapshot.level_hint')
  doc.goals = normalizeStringArray(doc.goals, 'listeningSourceSnapshot.goals')
  doc.grammar_focus = normalizeStringArray(
    doc.grammar_focus,
    'listeningSourceSnapshot.grammar_focus'
  )
  doc.listening_focus = normalizeStringArray(
    doc.listening_focus,
    'listeningSourceSnapshot.listening_focus'
  )
  doc.mistake_signals = assertArray(
    doc.mistake_signals,
    'listeningSourceSnapshot.mistake_signals'
  ).map((entry, index) => {
    const label = 'listeningSourceSnapshot.mistake_signals[' + index + ']'
    const item = assertObject(entry, label)
    return {
      tag: assertString(item.tag, label + '.tag'),
      count: assertInteger(item.count, label + '.count')
    }
  })
  doc.vocabulary_targets = assertArray(
    doc.vocabulary_targets,
    'listeningSourceSnapshot.vocabulary_targets'
  ).map((entry, index) => {
    const label = 'listeningSourceSnapshot.vocabulary_targets[' + index + ']'
    const item = assertObject(entry, label)
    return {
      id: assertString(item.id, label + '.id'),
      word: assertString(item.word, label + '.word'),
      kana: assertString(item.kana, label + '.kana'),
      meaning: assertString(item.meaning, label + '.meaning'),
      status: assertString(item.status, label + '.status')
    }
  })
  return doc
}

const validateListeningSession = (value) => {
  const doc = validateBaseDocument(value, 'listeningSession')
  assertString(doc.id, 'listeningSession.id')
  assertString(doc.date, 'listeningSession.date')
  assertString(doc.created_at, 'listeningSession.created_at')
  assertString(doc.source_snapshot_id, 'listeningSession.source_snapshot_id')
  assertString(doc.prompt_file, 'listeningSession.prompt_file')

  doc.plan = assertObject(doc.plan, 'listeningSession.plan')
  assertString(doc.plan.title, 'listeningSession.plan.title')
  assertString(doc.plan.scenario_id, 'listeningSession.plan.scenario_id')
  assertString(doc.plan.scenario_label, 'listeningSession.plan.scenario_label')
  assertString(doc.plan.level, 'listeningSession.plan.level')
  assertInteger(doc.plan.estimated_minutes, 'listeningSession.plan.estimated_minutes')
  doc.plan.focus_lessons = assertArray(
    doc.plan.focus_lessons,
    'listeningSession.plan.focus_lessons'
  ).map((lesson, index) =>
    assertInteger(lesson, 'listeningSession.plan.focus_lessons[' + index + ']')
  )
  doc.plan.target_grammar = normalizeStringArray(
    doc.plan.target_grammar,
    'listeningSession.plan.target_grammar'
  )
  doc.plan.target_vocabulary_ids = normalizeStringArray(
    doc.plan.target_vocabulary_ids,
    'listeningSession.plan.target_vocabulary_ids'
  )
  doc.plan.goals = normalizeStringArray(doc.plan.goals, 'listeningSession.plan.goals')

  doc.audio = assertObject(doc.audio, 'listeningSession.audio')
  assertString(doc.audio.lang, 'listeningSession.audio.lang')
  assertNumber(doc.audio.default_rate, 'listeningSession.audio.default_rate')
  assertString(doc.audio.voice_hint, 'listeningSession.audio.voice_hint')

  doc.script = assertObject(doc.script, 'listeningSession.script')
  assertString(doc.script.title, 'listeningSession.script.title')
  assertString(doc.script.summary_zh, 'listeningSession.script.summary_zh')
  assertString(doc.script.full_text, 'listeningSession.script.full_text')
  doc.script.segments = assertArray(
    doc.script.segments,
    'listeningSession.script.segments'
  ).map((entry, index) => {
    const label = 'listeningSession.script.segments[' + index + ']'
    const segment = assertObject(entry, label)
    return {
      id: assertString(segment.id, label + '.id'),
      speaker: assertString(segment.speaker, label + '.speaker'),
      text: assertString(segment.text, label + '.text'),
      kana: assertString(segment.kana, label + '.kana'),
      meaning_zh: assertString(segment.meaning_zh, label + '.meaning_zh'),
      focus: assertString(segment.focus, label + '.focus')
    }
  })
  doc.script.glossary = assertArray(
    doc.script.glossary,
    'listeningSession.script.glossary'
  ).map((entry, index) => {
    const label = 'listeningSession.script.glossary[' + index + ']'
    const item = assertObject(entry, label)
    return {
      id: assertString(item.id, label + '.id'),
      word: assertString(item.word, label + '.word'),
      kana: assertString(item.kana, label + '.kana'),
      meaning: assertString(item.meaning, label + '.meaning')
    }
  })

  doc.comprehension = assertObject(doc.comprehension, 'listeningSession.comprehension')
  doc.comprehension.questions = assertArray(
    doc.comprehension.questions,
    'listeningSession.comprehension.questions'
  ).map((entry, index) => {
    const label = 'listeningSession.comprehension.questions[' + index + ']'
    const question = assertObject(entry, label)
    return {
      id: assertString(question.id, label + '.id'),
      type: assertString(question.type, label + '.type'),
      prompt_zh: assertString(question.prompt_zh, label + '.prompt_zh'),
      choices: normalizeStringArray(question.choices || [], label + '.choices'),
      answer_reference: assertString(question.answer_reference, label + '.answer_reference'),
      accepted_keywords: normalizeStringArray(
        question.accepted_keywords || [],
        label + '.accepted_keywords'
      ),
      explanation_zh: assertString(question.explanation_zh, label + '.explanation_zh'),
      segment_ids: normalizeStringArray(question.segment_ids, label + '.segment_ids')
    }
  })

  doc.workplace_response = assertObject(
    doc.workplace_response,
    'listeningSession.workplace_response'
  )
  assertString(doc.workplace_response.prompt_zh, 'listeningSession.workplace_response.prompt_zh')
  assertString(doc.workplace_response.context_zh, 'listeningSession.workplace_response.context_zh')
  assertString(
    doc.workplace_response.answer_reference,
    'listeningSession.workplace_response.answer_reference'
  )
  doc.workplace_response.acceptable_variants = normalizeStringArray(
    doc.workplace_response.acceptable_variants,
    'listeningSession.workplace_response.acceptable_variants'
  )
  return doc
}

const validateListeningAttempt = (value) => {
  const doc = validateBaseDocument(value, 'listeningAttempt')
  assertString(doc.id, 'listeningAttempt.id')
  assertString(doc.session_id, 'listeningAttempt.session_id')
  assertString(doc.status, 'listeningAttempt.status')
  assertString(doc.started_at, 'listeningAttempt.started_at')
  if (doc.submitted_at !== null) {
    assertString(doc.submitted_at, 'listeningAttempt.submitted_at')
  }
  assertString(doc.current_stage, 'listeningAttempt.current_stage')
  assertBoolean(doc.transcript_revealed, 'listeningAttempt.transcript_revealed')
  doc.playback_counts = assertObject(doc.playback_counts, 'listeningAttempt.playback_counts')
  for (const [key, count] of Object.entries(doc.playback_counts)) {
    if (assertInteger(count, 'listeningAttempt.playback_counts.' + key) < 0) {
      throw new Error('listeningAttempt playback counts must be non-negative')
    }
  }
  doc.answers = assertObject(doc.answers, 'listeningAttempt.answers')
  for (const [key, answer] of Object.entries(doc.answers)) {
    assertString(answer, 'listeningAttempt.answers.' + key, { allowEmpty: true })
  }
  assertString(doc.response_answer, 'listeningAttempt.response_answer', { allowEmpty: true })
  doc.shadowing = assertArray(doc.shadowing, 'listeningAttempt.shadowing').map((entry, index) => {
    const label = 'listeningAttempt.shadowing[' + index + ']'
    const item = assertObject(entry, label)
    return {
      segment_id: assertString(item.segment_id, label + '.segment_id'),
      completed: assertBoolean(item.completed, label + '.completed'),
      self_rating: item.self_rating == null ? null : assertInteger(item.self_rating, label + '.self_rating'),
      recording_file:
        item.recording_file == null
          ? null
          : assertString(item.recording_file, label + '.recording_file'),
      recorded_at:
        item.recorded_at == null
          ? null
          : assertString(item.recorded_at, label + '.recorded_at')
    }
  })
  doc.reflection = assertObject(doc.reflection, 'listeningAttempt.reflection')
  doc.reflection.confidence =
    doc.reflection.confidence == null
      ? null
      : assertInteger(doc.reflection.confidence, 'listeningAttempt.reflection.confidence')
  doc.reflection.difficult_segment_ids = normalizeStringArray(
    doc.reflection.difficult_segment_ids,
    'listeningAttempt.reflection.difficult_segment_ids'
  )
  assertString(doc.reflection.note, 'listeningAttempt.reflection.note', { allowEmpty: true })
  if (doc.feedback !== null) {
    const feedback = assertObject(doc.feedback, 'listeningAttempt.feedback')
    assertNumber(feedback.accuracy, 'listeningAttempt.feedback.accuracy')
    assertInteger(feedback.correct_count, 'listeningAttempt.feedback.correct_count')
    assertInteger(feedback.total_count, 'listeningAttempt.feedback.total_count')
    assertString(feedback.summary_zh, 'listeningAttempt.feedback.summary_zh')
    feedback.question_results = assertArray(
      feedback.question_results,
      'listeningAttempt.feedback.question_results'
    )
    feedback.retry_segment_ids = normalizeStringArray(
      feedback.retry_segment_ids,
      'listeningAttempt.feedback.retry_segment_ids'
    )
    feedback.next_focus = normalizeStringArray(
      feedback.next_focus,
      'listeningAttempt.feedback.next_focus'
    )
  }
  return doc
}

const validateListeningProgress = (value) => {
  const doc = validateBaseDocument(value, 'listeningProgress')
  for (const key of [
    'total_attempts',
    'completed_attempts',
    'comprehension_correct',
    'comprehension_total',
    'shadowing_completed_segments',
    'shadowing_total_segments',
    'workplace_response_count'
  ]) {
    if (assertInteger(doc[key], 'listeningProgress.' + key) < 0) {
      throw new Error('listeningProgress counters must be non-negative')
    }
  }
  assertNumber(doc.average_accuracy, 'listeningProgress.average_accuracy')
  assertNumber(doc.average_shadowing_rating, 'listeningProgress.average_shadowing_rating')
  doc.scenario_counts = assertObject(doc.scenario_counts, 'listeningProgress.scenario_counts')
  for (const [key, count] of Object.entries(doc.scenario_counts)) {
    assertInteger(count, 'listeningProgress.scenario_counts.' + key)
  }
  doc.recent_focus = normalizeStringArray(doc.recent_focus, 'listeningProgress.recent_focus')
  return doc
}

const validateListeningReviewQueue = (value) => {
  const doc = validateBaseDocument(value, 'listeningReviewQueue')
  doc.items = assertArray(doc.items, 'listeningReviewQueue.items').map((entry, index) => {
    const label = 'listeningReviewQueue.items[' + index + ']'
    const item = assertObject(entry, label)
    return {
      id: assertString(item.id, label + '.id'),
      session_id: assertString(item.session_id, label + '.session_id'),
      status: assertString(item.status, label + '.status'),
      due_date: assertString(item.due_date, label + '.due_date'),
      reason: assertString(item.reason, label + '.reason'),
      focus_segment_ids: normalizeStringArray(
        item.focus_segment_ids,
        label + '.focus_segment_ids'
      ),
      last_accuracy: assertNumber(item.last_accuracy, label + '.last_accuracy'),
      updated_at: assertString(item.updated_at, label + '.updated_at')
    }
  })
  return doc
}

export {
  LISTENING_LAB_SCHEMA_VERSION,
  validateListeningAttempt,
  validateListeningLabIndex,
  validateListeningProgress,
  validateListeningReviewQueue,
  validateListeningSession,
  validateListeningSourceSnapshot
}
