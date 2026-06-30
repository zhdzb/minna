import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyContextCompressor } from '../src/server/agentStudy/contextCompressor.js'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-compress-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'daily'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'reviews'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'context'), { recursive: true })
  fs.mkdirSync(path.join(studyRoot, 'logs'), { recursive: true })
  return studyRoot
}

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyContextCompressor', () => {
  it('creates a weekly snapshot, shortens next-agent-context, and appends an event', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'index.json'), {
      schema_version: 1,
      revision: 2,
      updated_at: '2026-06-30T09:00:00+08:00',
      latest_daily: 'study/daily/2026-06-30.json',
      latest_prompt: 'study/prompts/generated/2026-06-30-review.md',
      latest_review: 'study/reviews/2026-06-30-review.json',
      schema_versions: {
        index: 1,
        profile: 1,
        current: 1,
        mastery: 1,
        review_queue: 1,
        promotion_rules: 1,
        daily_packet: 1,
        review_result: 1,
        review_drill: 1
      }
    })
    writeJson(path.join(studyRoot, 'state', 'current.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T09:00:00+08:00',
      current_lesson: 7,
      learning_mode: 'foundation_rebuild',
      active_goals: ['stabilize lesson 7 output', 'keep review queue moving'],
      weakness_summary: [],
      recent_focus: {
        grammar: ['N de V', 'N1 wa N2 ni V-te moraimashita'],
        listening: ['lesson 7 key phrases'],
        speaking: ['controlled replies']
      },
      next_recommendation: {
        date: '2026-06-30',
        plan_type: 'review_then_output',
        minutes: 45
      }
    })
    writeJson(path.join(studyRoot, 'state', 'mastery.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T09:00:00+08:00',
      current_gate: 'lesson-7-foundation',
      lesson_states: {
        'lesson-7': {
          lesson: 7,
          status: 'weak',
          skill_scores: {
            grammar: 0.44,
            listening: 0.36,
            speaking: 0.33,
            reading: 0.51
          },
          last_reviewed_at: '2026-06-30T08:30:00+08:00'
        }
      },
      grammar_points: {
        'lesson-7/tool-means': {
          lesson: 7,
          pattern: 'N de V',
          status: 'weak',
          recognition: 0.4,
          controlled_output: 0.15,
          free_output: 0.05,
          last_practiced_at: '2026-06-30T08:30:00+08:00'
        }
      }
    })
    writeJson(path.join(studyRoot, 'state', 'review-queue.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T09:00:00+08:00',
      items: [
        {
          id: 'rq-001',
          kind: 'grammar_point',
          key: 'lesson-7/tool-means',
          status: 'due',
          due_date: '2026-06-30',
          interval_days: 1,
          ease: 2.1,
          last_result: 'wrong'
        }
      ]
    })
    writeJson(path.join(studyRoot, 'daily', '2026-06-30.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T09:00:00+08:00',
      id: 'daily-2026-06-30',
      date: '2026-06-30',
      status: 'reviewed',
      created_at: '2026-06-30T09:00:00+08:00',
      mission: {
        title: 'Lesson 7 review',
        plan_type: 'review_then_output',
        available_minutes: 45,
        focus_lessons: [7],
        goals: ['stabilize lesson 7']
      },
      tasks: [],
      study_materials: [],
      review_items: [],
      exercises: [],
      answers: {},
      self_assessment: {
        difficulty: null,
        uncertain_exercise_ids: [],
        confusing_points: [],
        pace: '',
        note: ''
      },
      correction: {
        status: 'reviewed',
        prompt_file: 'study/prompts/generated/2026-06-30-review.md',
        review_file: 'study/reviews/2026-06-30-review.json'
      },
      review_result: null
    })
    writeJson(path.join(studyRoot, 'reviews', '2026-06-30-review.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-30T21:00:00+08:00',
      id: 'review-2026-06-30',
      daily_id: 'daily-2026-06-30',
      created_at: '2026-06-30T21:00:00+08:00',
      overall: {
        accuracy: 0.74,
        can_advance: false,
        summary: 'Means particle still needs another controlled pass.',
        next_focus: ['N de V', 'morau short replies']
      },
      items: [
        {
          exercise_id: 'ex-001',
          is_correct: false,
          score: 0.25,
          error_tags: ['particle'],
          target_grammar: 'N de V',
          user_answer: '',
          correct_answer: 'Basu de ikimasu.',
          explanation: 'The means particle is still unstable.',
          retry_recommended: true,
          rubric: {
            target_particle: 0
          },
          confidence: 0.9,
          needs_user_input: false,
          acceptable_variants: [],
          manual_override: null
        }
      ],
      mastery_updates: [],
      review_queue_updates: [],
      promotion_decision: {
        can_advance: false,
        reason: 'Need one more clean review cycle.'
      }
    })
    fs.writeFileSync(
      path.join(studyRoot, 'context', 'next-agent-context.md'),
      [
        '# Next Agent Context',
        '',
        'This is a deliberately long context block that mentions many details from prior turns.',
        'It should be compressed into a shorter version that keeps file references and key state.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.'
      ].join('\n'),
      'utf8'
    )
    fs.writeFileSync(
      path.join(studyRoot, 'logs', 'agent-events.jsonl'),
      [
        '{"event_id":"e1","time":"2026-06-30T09:00:00+08:00","actor":"codex","event":"daily_reviewed","input_files":["study/daily/2026-06-30.json"],"output_files":["study/reviews/2026-06-30-review.json"],"summary":"Reviewed lesson 7 packet."}',
        '{"event_id":"e2","time":"2026-06-30T10:00:00+08:00","actor":"frontend","event":"review_drill_saved","input_files":["study/review-drills/2026-06-30.json"],"output_files":["study/review-drills/2026-06-30.json"],"summary":"Saved review drill draft."}'
      ].join('\n') + '\n',
      'utf8'
    )

    const compressor = createAgentStudyContextCompressor({
      studyRoot,
      now: () => '2026-06-30T12:00:00+08:00'
    })
    const result = compressor.compressContext()

    expect(result.snapshot.path).toBe('study/context/snapshots/2026-W27-context.md')
    expect(result.snapshot.content).toContain('## Recent Events')
    expect(result.nextAgentContext.content).toContain('study/context/snapshots/2026-W27-context.md')
    expect(result.nextAgentContext.content.length).toBeLessThan(
      fs.readFileSync(path.join(studyRoot, 'context', 'snapshots', '2026-W27-context.md'), 'utf8').length
    )
    expect(result.nextAgentContext.content.length).toBeLessThan(
      [
        '# Next Agent Context',
        '',
        'This is a deliberately long context block that mentions many details from prior turns.',
        'It should be compressed into a shorter version that keeps file references and key state.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.',
        'Repeat detail: lesson 7, review queue, mastery, daily packet, review packet, event log.'
      ].join('\n').length
    )
    expect(
      fs.readFileSync(path.join(studyRoot, 'context', 'next-agent-context.md'), 'utf8')
    ).toBe(result.nextAgentContext.content)

    const logLines = fs
      .readFileSync(path.join(studyRoot, 'logs', 'agent-events.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
    expect(logLines).toHaveLength(3)
    expect(JSON.parse(logLines[2]).event).toBe('context_compressed')
  })

  it('builds snapshot text with traceable file references and no raw JSON dump', () => {
    const compressor = createAgentStudyContextCompressor()
    const snapshot = compressor.buildSnapshotContent({
      now: '2026-06-30T12:00:00+08:00',
      snapshotPath: 'study/context/snapshots/2026-W27-context.md',
      indexDocument: {
        latest_daily: 'study/daily/2026-06-26.json',
        latest_review: 'study/reviews/2026-06-26-review.json',
        latest_prompt: 'study/prompts/generated/2026-06-26-review.md'
      },
      currentState: {
        current_lesson: 7,
        learning_mode: 'foundation_rebuild',
        active_goals: ['stabilize lesson 7'],
        recent_focus: { grammar: [] }
      },
      masteryState: {
        current_gate: 'lesson-7-foundation',
        grammar_points: {
          'lesson-7/tool-means': {
            pattern: 'N de V',
            status: 'weak',
            controlled_output: 0.1
          }
        }
      },
      reviewQueueState: {
        items: [
          {
            key: 'lesson-7/tool-means',
            status: 'due',
            last_result: 'wrong',
            due_date: '2026-06-30'
          }
        ]
      },
      dailyPacket: null,
      reviewResult: null,
      previousContext: '# prior context',
      recentEvents: [],
      snapshotPath: 'study/context/snapshots/2026-W27-context.md'
    })

    expect(snapshot).toContain('study/daily/2026-06-26.json')
    expect(snapshot).toContain('study/reviews/2026-06-26-review.json')
    expect(snapshot).not.toContain('"schema_version"')
  })
})
