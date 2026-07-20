import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildExerciseCountForMinutes,
  createAgentStudyDailyPacketGenerator
} from '../src/server/agentStudy/dailyPacketGenerator.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-daily-generator-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'prompts', 'generated'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'context'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'logs'), { recursive: true })
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

const seedStudyState = (studyRoot) => {
  writeJson(path.join(studyRoot, 'index.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    latest_daily: null,
    latest_prompt: null,
    latest_review: null,
    schema_versions: {
      index: 1,
      profile: 1,
      current: 1,
      mastery: 1,
      review_queue: 1,
      promotion_rules: 1,
      daily_packet: 1,
      review_result: 1
    }
  })

  writeJson(path.join(studyRoot, 'state', 'profile.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    learner_id: 'local-default',
    goals: ['从第1课重新开始'],
    daily_time_budget_minutes: 50,
    pace_preference: 'steady',
    input_preferences: {
      allow_romaji: true,
      prefer_kana_first: true,
      practice_kanji: true,
      ui_language: 'zh-CN'
    },
    material_scope: {
      series: '大家的日本语',
      current_focus_lessons: [1],
      allow_new_lessons: true
    },
    notes: ['测试生成学习包']
  })

  writeJson(path.join(studyRoot, 'state', 'current.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    current_lesson: 1,
    learning_mode: 'foundation_reset',
    active_goals: ['建立第一课基础'],
    weakness_summary: [],
    recent_focus: {
      grammar: ['N1 は N2 です', 'N1 の N2'],
      listening: ['自我介绍音频'],
      speaking: ['初次见面寒暄']
    },
    next_recommendation: {
      date: '2026-07-01',
      plan_type: 'lesson-foundation',
      minutes: 50
    }
  })

  writeJson(path.join(studyRoot, 'state', 'mastery.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    current_gate: 'lesson-1-foundation',
    lesson_states: {},
    grammar_points: {
      'lesson-1/wa-desu': {
        lesson: 1,
        pattern: 'N1 は N2 です',
        status: 'learning',
        recognition: 0.5,
        controlled_output: 0.3,
        free_output: 0.2,
        last_practiced_at: '2026-07-01T08:00:00+08:00'
      }
    }
  })

  writeJson(path.join(studyRoot, 'state', 'review-queue.json'), {
    schema_version: 1,
    revision: 1,
    updated_at: '2026-07-01T09:00:00+08:00',
    items: [
      {
        id: 'rq-lesson-1-wa-desu',
        kind: 'grammar_point',
        key: 'lesson-1/wa-desu',
        status: 'due',
        due_date: '2026-07-01',
        interval_days: 1,
        ease: 2.3,
        last_result: 'wrong'
      }
    ]
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyDailyPacketGenerator', () => {
  it('allows a 60 minute session to contain 20 exercises', () => {
    expect(buildExerciseCountForMinutes(60)).toBe(20)
    expect(buildExerciseCountForMinutes(90)).toBe(30)
  })

  it('creates a new daily packet, prompt file, context, and index update', async () => {
    const studyRoot = createTempStudyRoot()
    seedStudyState(studyRoot)

    const generator = createAgentStudyDailyPacketGenerator({
      studyRoot,
      now: () => '2026-07-01T12:00:00+08:00',
      requestLlm: async () => {
        throw new Error('No LLM in test')
      }
    })

    const result = await generator.generate({ date: '2026-07-01' })

    expect(result.reused).toBe(false)
    expect(result.dailyPacket.id).toBe('daily-2026-07-01')
    expect(result.dailyPacket.mission.focus_lessons).toEqual([1])
    expect(result.dailyPacket.study_materials.length).toBeGreaterThanOrEqual(3)
    expect(result.dailyPacket.exercises.length).toBeGreaterThanOrEqual(3)
    expect(result.dailyPacket.exercises[0].instruction).toBeTruthy()
    expect(result.dailyPacket.exercises[0].answer_format).toBeTruthy()
    expect(result.dailyPacket.exercises.every((exercise) => exercise.type !== 'q_fill')).toBe(true)

    const typeCounts = result.dailyPacket.exercises.reduce((counts, exercise) => {
      counts[exercise.type] = (counts[exercise.type] || 0) + 1
      return counts
    }, {})
    expect(typeCounts.q_translate).toBeGreaterThan(typeCounts.q_conversation)
    expect(typeCounts.q_reading).toBeGreaterThan(0)
    expect(typeCounts.q_listening).toBeGreaterThan(0)

    const conversationExercise = result.dailyPacket.exercises.find((exercise) => exercise.type === 'q_conversation')
    expect(conversationExercise.supporting_lines?.length || 0).toBeGreaterThanOrEqual(2)
    expect(conversationExercise.supporting_lines[1]).toBe('B：（这里由你作答）')
    expect(conversationExercise.supporting_lines.join(' ')).not.toContain(conversationExercise.answer_reference)

    const listeningExercise = result.dailyPacket.exercises.find((exercise) => exercise.type === 'q_listening')
    expect(listeningExercise.metadata.audio_text).toBeTruthy()
    expect(listeningExercise.supporting_lines).not.toContain(listeningExercise.metadata.audio_text)

    const writtenDaily = JSON.parse(fs.readFileSync(path.join(studyRoot, 'daily', '2026-07-01.json'), 'utf8'))
    const writtenIndex = JSON.parse(fs.readFileSync(path.join(studyRoot, 'index.json'), 'utf8'))
    const promptBody = fs.readFileSync(path.join(studyRoot, 'prompts', 'generated', '2026-07-01-review.md'), 'utf8')
    const contextBody = fs.readFileSync(path.join(studyRoot, 'context', 'next-agent-context.md'), 'utf8')
    const logLines = fs.readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8').trim().split(/\r?\n/)

    expect(writtenDaily.correction.prompt_file).toBe('study/prompts/generated/2026-07-01-review.md')
    expect(writtenIndex.latest_daily).toBe('study/daily/2026-07-01.json')
    expect(writtenIndex.latest_prompt).toBe('study/prompts/generated/2026-07-01-review.md')
    expect(promptBody).toContain('学习包批改提示词')
    expect(contextBody).toContain('study/daily/2026-07-01.json')
    expect(logLines.length).toBe(1)
    expect(JSON.parse(logLines[0]).event).toBe('daily_packet_created')
  })

  it('reuses the same-day packet instead of overwriting it', async () => {
    const studyRoot = createTempStudyRoot()
    seedStudyState(studyRoot)
    writeJson(path.join(studyRoot, 'daily', '2026-07-01.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-07-01T10:00:00+08:00',
      id: 'daily-2026-07-01',
      date: '2026-07-01',
      status: 'planned',
      created_at: '2026-07-01T10:00:00+08:00',
      mission: {
        title: '已有学习包',
        plan_type: 'lesson-foundation',
        available_minutes: 30,
        focus_lessons: [1],
        goals: ['复用']
      },
      tasks: [
        { id: 'task-1', type: 'grammar_review', title: '已有任务', minutes: 10, required: true, status: 'pending' }
      ],
      study_materials: [
        {
          id: 'material-1',
          type: 'grammar_note',
          lesson: 1,
          title: '已有资料',
          content: '已有资料',
          examples: [
            { ja: 'わたし は マイク です。', zh: '我是麦克。', note: '例句1' },
            { ja: 'あの ひと は せんせい です。', zh: '那个人是老师。', note: '例句2' }
          ]
        },
        {
          id: 'material-2',
          type: 'listening_script',
          lesson: 1,
          title: '已有脚本',
          content: 'A: はじめまして。',
          examples: [
            { ja: 'はじめまして。', zh: '初次见面。', note: '例句1' },
            { ja: 'どうぞ よろしく おねがいします。', zh: '请多关照。', note: '例句2' }
          ]
        }
      ],
      review_items: [],
      exercises: [
        {
          id: 'exercise-1',
          type: 'q_translate',
          lesson: 1,
          target_grammar: 'N1 は N2 です',
          prompt: '请翻译',
          instruction: '把“我是学生”说成日语。',
          context_note: '请使用完整句子。',
          answer_format: '写 1 句完整、自然的日语句子。',
          choices: [],
          supporting_lines: [],
          vocab_hints: [],
          answer_reference: 'わたし は がくせい です。',
          metadata: { source: 'test', difficulty: 'foundation', skill: 'output' }
        }
      ],
      answers: { 'exercise-1': '' },
      self_assessment: {
        difficulty: null,
        uncertain_exercise_ids: [],
        confusing_points: [],
        pace: '',
        note: ''
      },
      correction: {
        status: 'pending',
        prompt_file: 'study/prompts/generated/2026-07-01-review.md',
        review_file: ''
      },
      review_result: null
    })

    const generator = createAgentStudyDailyPacketGenerator({
      studyRoot,
      now: () => '2026-07-01T12:00:00+08:00'
    })

    const result = await generator.generate({ date: '2026-07-01' })

    expect(result.reused).toBe(true)
    expect(result.dailyPacket.mission.title).toBe('已有学习包')
  })
})
