import { defineStore } from 'pinia'

const createReviewItemId = () =>
  `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createDailyTaskId = () =>
  `plan_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getDefaultDailyPlan = () => ({
  date: null,
  available_minutes: null,
  plan_type: '',
  focus_lessons: [],
  tasks: [],
  completion_criteria: [],
  ai_summary: ''
})

const getDefaultLessonMasteryEntry = () => ({
  grammar: 0,
  listening: 0,
  speaking: 0,
  reading: 0,
  last_reviewed_at: null
})

const getDefaultPatternMasteryEntry = () => ({
  lesson: 1,
  pattern: '',
  recognition: 0,
  controlled_output: 0,
  free_output: 0,
  last_practiced_at: null
})

const getDefaultData = () => ({
  progress: {
    current_lesson: 1,
    completed_types_by_lesson: {},
    pass_threshold: 0.5,
    lesson_stats: {}
  },
  daily_plan: getDefaultDailyPlan(),
  lesson_mastery: {},
  pattern_mastery: {},
  mistakes_book: [],
  study_backups: [],
  meta: {
    updated_at: null
  }
})

const normalizeReviewItem = (item = {}) => ({
  id: item.id || createReviewItemId(),
  timestamp: item.timestamp || new Date().toISOString(),
  mark_type: item.mark_type || 'mistake',
  lesson: item.lesson || 1,
  grammar_point: item.grammar_point || item.target_grammar || item.question_type || '',
  question_type: item.question_type || item.exercise_snapshot?.type || '',
  original_question: item.original_question || '',
  user_wrong_input: item.user_wrong_input || '',
  correct_answer: item.correct_answer || '',
  explanation: item.explanation || '',
  exercise_snapshot:
    item.exercise_snapshot && typeof item.exercise_snapshot === 'object'
      ? item.exercise_snapshot
      : null,
  evaluation_snapshot:
    item.evaluation_snapshot && typeof item.evaluation_snapshot === 'object'
      ? item.evaluation_snapshot
      : null
})

const normalizeBackup = (backup = {}) => ({
  id: backup.id || `backup_${Date.now()}`,
  label: backup.label || '',
  timestamp: backup.timestamp || new Date().toISOString(),
  snapshot: backup.snapshot && typeof backup.snapshot === 'object' ? backup.snapshot : getDefaultData()
})

const normalizeDailyTask = (task = {}) => ({
  id: task.id || createDailyTaskId(),
  type: task.type || '',
  title: task.title || '',
  minutes: Number.isFinite(Number(task.minutes)) ? Number(task.minutes) : 0,
  required: task.required !== false,
  status: task.status || 'pending'
})

const normalizeDailyPlan = (plan) => {
  const base = getDefaultDailyPlan()
  if (!plan || typeof plan !== 'object') return base

  return {
    ...base,
    ...plan,
    date: typeof plan.date === 'string' ? plan.date : base.date,
    available_minutes: Number.isFinite(Number(plan.available_minutes))
      ? Number(plan.available_minutes)
      : base.available_minutes,
    plan_type: typeof plan.plan_type === 'string' ? plan.plan_type : base.plan_type,
    focus_lessons: Array.isArray(plan.focus_lessons)
      ? plan.focus_lessons.filter((lesson) => Number.isFinite(Number(lesson))).map(Number)
      : base.focus_lessons,
    tasks: Array.isArray(plan.tasks) ? plan.tasks.map(normalizeDailyTask) : base.tasks,
    completion_criteria: Array.isArray(plan.completion_criteria)
      ? plan.completion_criteria.filter((criterion) => typeof criterion === 'string')
      : base.completion_criteria,
    ai_summary: typeof plan.ai_summary === 'string' ? plan.ai_summary : base.ai_summary
  }
}

const normalizeMasteryScore = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

const normalizeLessonMasteryEntry = (entry = {}) => {
  const base = getDefaultLessonMasteryEntry()

  return {
    ...base,
    grammar: normalizeMasteryScore(entry.grammar),
    listening: normalizeMasteryScore(entry.listening),
    speaking: normalizeMasteryScore(entry.speaking),
    reading: normalizeMasteryScore(entry.reading),
    last_reviewed_at: typeof entry.last_reviewed_at === 'string' ? entry.last_reviewed_at : base.last_reviewed_at
  }
}

const normalizeLessonMastery = (mastery) => {
  if (!mastery || typeof mastery !== 'object' || Array.isArray(mastery)) {
    return {}
  }

  return Object.entries(mastery).reduce((accumulator, [lessonId, entry]) => {
    const normalizedLessonId = Number(lessonId)
    if (!Number.isFinite(normalizedLessonId)) return accumulator

    accumulator[String(normalizedLessonId)] = normalizeLessonMasteryEntry(entry)
    return accumulator
  }, {})
}

const normalizePatternMasteryEntry = (entry = {}, patternId = '') => {
  const base = getDefaultPatternMasteryEntry()
  const normalizedPattern = typeof entry.pattern === 'string' && entry.pattern.trim() ? entry.pattern : patternId
  const normalizedLesson = Number(entry.lesson)

  return {
    ...base,
    lesson: Number.isFinite(normalizedLesson) ? normalizedLesson : base.lesson,
    pattern: normalizedPattern,
    recognition: normalizeMasteryScore(entry.recognition),
    controlled_output: normalizeMasteryScore(entry.controlled_output),
    free_output: normalizeMasteryScore(entry.free_output),
    last_practiced_at:
      typeof entry.last_practiced_at === 'string' ? entry.last_practiced_at : base.last_practiced_at
  }
}

const normalizePatternMastery = (mastery) => {
  if (!mastery || typeof mastery !== 'object' || Array.isArray(mastery)) {
    return {}
  }

  return Object.entries(mastery).reduce((accumulator, [patternId, entry]) => {
    const normalizedPatternId = String(patternId || '').trim()
    if (!normalizedPatternId) return accumulator

    accumulator[normalizedPatternId] = normalizePatternMasteryEntry(entry, normalizedPatternId)
    return accumulator
  }, {})
}

const normalizeData = (data) => {
  const base = getDefaultData()
  const merged = {
    ...base,
    ...data,
    progress: {
      ...base.progress,
      ...(data?.progress || {})
    },
    mistakes_book: Array.isArray(data?.mistakes_book)
      ? data.mistakes_book.map(normalizeReviewItem)
      : base.mistakes_book,
    study_backups: Array.isArray(data?.study_backups)
      ? data.study_backups.map(normalizeBackup)
      : base.study_backups,
    daily_plan: normalizeDailyPlan(data?.daily_plan),
    lesson_mastery: normalizeLessonMastery(data?.lesson_mastery),
    pattern_mastery: normalizePatternMastery(data?.pattern_mastery),
    meta: {
      ...base.meta,
      ...(data?.meta || {})
    }
  }

  if (Array.isArray(data?.collections) && data.collections.length > 0) {
    merged.mistakes_book = [
      ...merged.mistakes_book,
      ...data.collections.map((item) =>
        normalizeReviewItem({
          ...item,
          mark_type: 'favorite'
        })
      )
    ]
  }

  return merged
}

const mergeBackups = (current = [], incoming = []) => {
  const merged = [...incoming, ...current].map(normalizeBackup)
  const seen = new Set()

  return merged.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const buildPersistableState = (state, options = {}) => {
  const includeBackups = options.includeBackups !== false

  return normalizeData({
    ...state,
    study_backups: includeBackups ? state.study_backups : []
  })
}

export const useMainStore = defineStore('main', {
  state: () => {
    const saved = localStorage.getItem('minna_app_data')
    if (saved) {
      try {
        return normalizeData(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to parse localStorage data, falling back to defaults.', error)
      }
    }

    return getDefaultData()
  },

  getters: {
    totalExercises(state) {
      const stats = state.progress?.lesson_stats || {}
      return Object.values(stats).reduce((sum, lesson) => sum + (lesson.last_question_count || 0), 0)
    },

    avgAccuracy(state) {
      const stats = state.progress?.lesson_stats || {}
      const lessons = Object.values(stats)
      if (lessons.length === 0) return 0

      const totalRate = lessons.reduce((sum, lesson) => sum + (lesson.last_correct_rate || 0), 0)
      return Math.round((totalRate / lessons.length) * 100) / 100
    },

    streakDays(state) {
      const stats = state.progress?.lesson_stats || {}
      const lessons = Object.values(stats)
      if (lessons.length === 0) return 0

      const studyDates = lessons
        .filter((lesson) => lesson.last_session_at)
        .map((lesson) => {
          const date = new Date(lesson.last_session_at)
          return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
        })
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => b - a)

      if (studyDates.length === 0) return 0

      const today = new Date()
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
      const yesterdayMidnight = todayMidnight - 86400000

      if (studyDates[0] < yesterdayMidnight) return 0

      let streak = 1
      let expectedPrev = studyDates[0] - 86400000

      for (let index = 1; index < studyDates.length; index += 1) {
        if (studyDates[index] === expectedPrev) {
          streak += 1
          expectedPrev -= 86400000
        } else if (studyDates[index] < expectedPrev) {
          break
        }
      }

      return streak
    },

    heatmapData(state) {
      const stats = state.progress?.lesson_stats || {}
      const lessons = Object.values(stats)
      const heatmap = {}
      const today = new Date()

      for (let index = 29; index >= 0; index -= 1) {
        const date = new Date(today)
        date.setDate(date.getDate() - index)
        const dateStr = date.toISOString().split('T')[0]
        heatmap[dateStr] = 0
      }

      lessons.forEach((lesson) => {
        if (!lesson.last_session_at) return
        const dateStr = lesson.last_session_at.split('T')[0]
        if (heatmap[dateStr] !== undefined) {
          heatmap[dateStr] += 1
        }
      })

      return heatmap
    },

    typeMastery(state) {
      const completedTypes = state.progress?.completed_types_by_lesson || {}
      const mastery = { q_fill: 0, q_translate: 0, q_conversation: 0 }

      Object.values(completedTypes).forEach((types) => {
        if (Array.isArray(types)) {
          types.forEach((type) => {
            if (mastery[type] !== undefined) mastery[type] += 1
          })
          return
        }

        if (typeof types === 'object' && types !== null) {
          Object.keys(types).forEach((type) => {
            if (mastery[type] !== undefined) mastery[type] += 1
          })
        }
      })

      return mastery
    },

    accuracyTrend(state) {
      const stats = state.progress?.lesson_stats || {}
      return Object.values(stats)
        .filter((lesson) => lesson.last_session_at)
        .sort((a, b) => new Date(a.last_session_at) - new Date(b.last_session_at))
        .map((lesson) => ({
          date: lesson.last_session_at.split('T')[0],
          rate: Math.round((lesson.last_correct_rate || 0) * 100),
          lesson: lesson.lesson_id
        }))
        .slice(-10)
    }
  },

  actions: {
    saveState() {
      if (!this.meta) this.meta = {}
      this.meta.updated_at = new Date().toISOString()

      const persistable = buildPersistableState(this.$state)
      const stateStr = JSON.stringify(persistable, null, 2)

      localStorage.setItem('minna_app_data', stateStr)

      fetch('/api/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stateStr
      }).catch((error) => {
        console.warn('Failed to sync progress to local disk.', error)
      })
    },

    addReviewItem(item, markType = 'mistake') {
      this.mistakes_book.push(
        normalizeReviewItem({
          ...item,
          mark_type: markType
        })
      )
      this.saveState()
    },

    addMistake(mistake) {
      this.addReviewItem(mistake, 'mistake')
    },

    removeReviewItem(id) {
      this.mistakes_book = this.mistakes_book.filter((item) => item.id !== id)
      this.saveState()
    },

    clearReviewItems() {
      this.mistakes_book = []
      this.saveState()
    },

    createBackupSnapshot(label = '') {
      const backup = normalizeBackup({
        id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim(),
        timestamp: new Date().toISOString(),
        snapshot: buildPersistableState(this.$state, { includeBackups: false })
      })

      this.study_backups = [backup, ...this.study_backups].slice(0, 20)
      this.saveState()

      return backup
    },

    restoreBackupSnapshot(id) {
      const backup = this.study_backups.find((item) => item.id === id)
      if (!backup) return false

      const backups = [...this.study_backups]
      this.$patch({
        ...normalizeData(backup.snapshot),
        study_backups: backups
      })
      this.saveState()

      return true
    },

    removeBackupSnapshot(id) {
      this.study_backups = this.study_backups.filter((item) => item.id !== id)
      this.saveState()
    },

    setPassThreshold(value) {
      const numeric = Number(value)
      if (Number.isNaN(numeric)) return

      this.progress.pass_threshold = Math.max(0.3, Math.min(1, numeric))
      this.saveState()
    },

    recordLessonStats(lessonId, stats) {
      if (!this.progress.lesson_stats) {
        this.progress.lesson_stats = {}
      }

      this.progress.lesson_stats[lessonId] = {
        lesson_id: lessonId,
        last_session_at: new Date().toISOString(),
        last_question_count: stats?.question_count || 0,
        last_correct_count: stats?.correct_count || 0,
        last_correct_rate: stats?.correct_rate || 0,
        last_difficulty: stats?.difficulty || '',
        last_question_type: stats?.question_type || ''
      }

      this.saveState()
    },

    markTypeCompleted(lessonId, typeId, difficulty = '基础巩固') {
      if (!this.progress.completed_types_by_lesson[lessonId]) {
        this.progress.completed_types_by_lesson[lessonId] = {}
      }

      let typeData = this.progress.completed_types_by_lesson[lessonId]

      if (Array.isArray(typeData)) {
        const migrated = {}
        typeData.forEach((type) => {
          migrated[type] = '基础巩固'
        })
        this.progress.completed_types_by_lesson[lessonId] = migrated
        typeData = migrated
      }

      const difficultyLevels = {
        基础巩固: 1,
        职场进阶: 2,
        JLPT真题级: 3
      }
      const currentLevel = difficultyLevels[difficulty] || 1
      const existingLevel = difficultyLevels[typeData[typeId]] || 0

      if (currentLevel > existingLevel) {
        typeData[typeId] = difficulty
      }

      this.saveState()
    },

    toggleTypeCompletion(lessonId, typeId) {
      if (!this.progress.completed_types_by_lesson[lessonId]) {
        this.progress.completed_types_by_lesson[lessonId] = {}
      }

      let typeData = this.progress.completed_types_by_lesson[lessonId]
      if (Array.isArray(typeData)) {
        const migrated = {}
        typeData.forEach((type) => {
          migrated[type] = '基础巩固'
        })
        this.progress.completed_types_by_lesson[lessonId] = migrated
        typeData = migrated
      }

      if (typeData[typeId]) {
        delete typeData[typeId]
      } else {
        typeData[typeId] = '特批免试'
      }

      this.saveState()
    },

    checkAndAdvanceLesson(targetLessonId, enabledTypes) {
      if (targetLessonId !== this.progress.current_lesson) {
        return false
      }

      let typeData = this.progress.completed_types_by_lesson[targetLessonId] || {}
      if (Array.isArray(typeData)) {
        const migrated = {}
        typeData.forEach((type) => {
          migrated[type] = '基础巩固'
        })
        typeData = migrated
      }

      const isAllCleared = enabledTypes.every((type) => Object.keys(typeData).includes(type))
      if (!isAllCleared) return false

      this.advanceLesson()
      return true
    },

    advanceLesson() {
      this.progress.current_lesson += 1
      this.saveState()
    },

    async hydrateFromDisk() {
      try {
        const response = await fetch('/data.json', { cache: 'no-cache' })
        if (!response.ok) return

        const diskData = normalizeData(await response.json())
        const localUpdated = this.meta?.updated_at ? new Date(this.meta.updated_at).getTime() : 0
        const diskUpdated = diskData.meta?.updated_at ? new Date(diskData.meta.updated_at).getTime() : 0
        const hasLocal = !!localStorage.getItem('minna_app_data')

        if (!hasLocal) {
          this.$patch(diskData)
          this.saveState()
          return
        }

        const isLocalEmpty =
          this.progress.current_lesson === 1 &&
          Object.keys(this.progress.completed_types_by_lesson || {}).length === 0 &&
          (this.mistakes_book || []).length === 0

        if (diskUpdated > localUpdated || isLocalEmpty) {
          this.$patch({
            ...diskData,
            study_backups: mergeBackups(this.study_backups, diskData.study_backups)
          })
          this.saveState()
        }
      } catch (_error) {
        return
      }
    },

    overwriteState(newState) {
      const normalized = normalizeData(newState)
      this.$patch({
        ...normalized,
        study_backups: mergeBackups(this.study_backups, normalized.study_backups)
      })
      this.saveState()
    }
  }
})

export {
  buildPersistableState,
  getDefaultData,
  getDefaultDailyPlan,
  getDefaultLessonMasteryEntry,
  getDefaultPatternMasteryEntry,
  normalizeData
}
