import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  LISTENING_LAB_SCHEMA_VERSION,
  validateListeningSourceSnapshot
} from '../src/utils/listeningLabSchema.js'
import { buildFeedback, createListeningLabStore } from '../src/server/listeningLab/store.js'
import { SCENARIOS } from '../src/server/listeningLab/sessionGenerator.js'
import { summarizeMistakeTags } from '../src/server/listeningLab/sourceSnapshot.js'

const temporaryRoots = []

const createTempRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'listening-lab-'))
  temporaryRoots.push(root)
  return root
}

const createSourceSnapshot = (timestamp = '2026-07-23T10:00:00.000Z') =>
  validateListeningSourceSnapshot({
    schema_version: LISTENING_LAB_SCHEMA_VERSION,
    revision: 1,
    updated_at: timestamp,
    id: 'listening-source-test',
    generated_at: timestamp,
    source_revisions: {
      profile: 1,
      current: 1,
      mastery: 1,
      review_queue: 1,
      mistakes: 1,
      vocabulary_progress: 1
    },
    current_lesson: 6,
    focus_lessons: [6, 7, 8, 9, 10],
    level_hint: 'N5-N4 bridge',
    goals: ['赴日工作'],
    grammar_focus: ['N を V', 'place で V'],
    listening_focus: ['职场确认'],
    mistake_signals: [{ tag: 'particle', count: 2 }],
    vocabulary_targets: [
      {
        id: 'vocab-005',
        word: '言う',
        kana: 'いう',
        meaning: '说',
        status: 'learning'
      }
    ]
  })

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('Listening Lab store', () => {
  it('includes both workplace dialogue and announcement-style listening content', () => {
    expect(SCENARIOS.some((scenario) => scenario.id === 'morning-meeting')).toBe(true)
    expect(SCENARIOS.some((scenario) => scenario.id === 'office-announcement')).toBe(true)
  })

  it('generates and archives an independent session and attempt', () => {
    const root = createTempRoot()
    const store = createListeningLabStore({
      root,
      now: () => '2026-07-23T10:00:00.000Z',
      sourceSnapshotBuilder: () => createSourceSnapshot()
    })

    const dashboard = store.generateSession({ scenarioId: 'morning-meeting' })

    expect(dashboard.latestSession.plan.scenario_id).toBe('morning-meeting')
    expect(dashboard.latestAttempt.status).toBe('in_progress')
    expect(dashboard.latestAttempt.transcript_revealed).toBe(false)
    expect(dashboard.latestSession.script.segments).toHaveLength(4)
    expect(dashboard.index.latest_session).toMatch(/^study\/listening\/sessions\//)
    expect(fs.existsSync(path.join(root, 'context', 'source-snapshot.json'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'context', 'next-agent-context.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'prompts', 'generated', dashboard.latestSession.id + '.md'))).toBe(true)
  })

  it('scores comprehension, updates only module progress and supports retry', () => {
    const root = createTempRoot()
    const timestamps = [
      '2026-07-23T10:00:00.000Z',
      '2026-07-23T10:05:00.000Z',
      '2026-07-23T10:10:00.000Z',
      '2026-07-23T10:12:00.000Z'
    ]
    const store = createListeningLabStore({
      root,
      now: () => timestamps.shift() || '2026-07-23T10:15:00.000Z',
      sourceSnapshotBuilder: () => createSourceSnapshot()
    })
    let dashboard = store.generateSession({ scenarioId: 'morning-meeting' })
    const attempt = dashboard.latestAttempt
    const session = dashboard.latestSession
    for (const question of session.comprehension.questions) {
      attempt.answers[question.id] = question.answer_reference
    }
    attempt.response_answer = 'はい、八時五十分までに行きます。'
    attempt.shadowing = attempt.shadowing.map((item) => ({
      ...item,
      completed: true,
      self_rating: 4
    }))

    dashboard = store.submitAttempt({ attempt })

    expect(dashboard.latestAttempt.status).toBe('submitted')
    expect(dashboard.latestAttempt.feedback.accuracy).toBe(1)
    expect(dashboard.progress.completed_attempts).toBe(1)
    expect(dashboard.progress.average_shadowing_rating).toBe(4)
    expect(dashboard.reviewQueue.items[0].due_date).toBe('2026-07-26')

    dashboard = store.retrySession({ sessionId: session.id })
    expect(dashboard.latestAttempt.id).toContain('attempt-02')
    expect(dashboard.latestAttempt.status).toBe('in_progress')
    expect(fs.readdirSync(path.join(root, 'attempts'))).toHaveLength(2)
  })

  it('archives a browser recording and keeps it addressable after reload', () => {
    const root = createTempRoot()
    const store = createListeningLabStore({
      root,
      now: () => '2026-07-23T10:00:00.000Z',
      sourceSnapshotBuilder: () => createSourceSnapshot()
    })
    let dashboard = store.generateSession({ scenarioId: 'morning-meeting' })
    const segmentId = dashboard.latestSession.script.segments[0].id

    dashboard = store.saveRecording({
      attemptId: dashboard.latestAttempt.id,
      segmentId,
      dataUrl: 'data:audio/webm;base64,' + Buffer.from('audio').toString('base64')
    })

    const recordingFile = dashboard.latestAttempt.shadowing[0].recording_file
    expect(recordingFile).toMatch(/^study\/listening\/audio\//)
    const resolved = store.resolveRecording(recordingFile)
    expect(resolved.mimeType).toBe('audio/webm')
    expect(fs.readFileSync(resolved.absolutePath, 'utf8')).toBe('audio')
  })
})

describe('Listening Lab feedback', () => {
  it('does not promote harmless spelling-equivalence tags into listening priorities', () => {
    const signals = summarizeMistakeTags({
      items: [
        {
          status: 'active',
          review_snapshot: {
            error_tags: ['kana_kanji', 'name_spelling', 'listening_mishear']
          }
        }
      ]
    })

    expect(signals).toEqual([{ tag: 'listening_mishear', count: 1 }])
  })

  it('accepts meaning-equivalent time answers instead of requiring exact transcription', () => {
    const session = {
      comprehension: {
        questions: [
          {
            id: 'q1',
            prompt_zh: '几点？',
            answer_reference: '八点五十分之前',
            accepted_keywords: ['8時50分', '八時五十分'],
            explanation_zh: '时间信息',
            segment_ids: ['s1']
          }
        ]
      }
    }
    const attempt = {
      answers: { q1: '8時50分です' },
      shadowing: [{ segment_id: 's1', completed: true }],
      reflection: { difficult_segment_ids: [] },
      response_answer: 'はい'
    }

    expect(buildFeedback({ session, attempt }).accuracy).toBe(1)
  })
})
