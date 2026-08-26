import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyContextWriter } from '../src/server/agentStudy/contextWriter'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-context-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'state'), { recursive: true })
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

describe('agentStudyContextWriter', () => {
  it('generates next-agent-context from the seeded study state', () => {
    const writer = createAgentStudyContextWriter()
    const index = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'study', 'index.json'), 'utf8')
    )
    const result = writer.writeNextAgentContext()

    expect(result.path).toBe('study/context/next-agent-context.md')
    expect(result.content).toContain(`最新 daily：${index.latest_daily}`)
    expect(result.content).toContain(`最新 review：${index.latest_review}`)
    expect(result.content).toContain(`最新 prompt：${index.latest_prompt}`)
    expect(result.content).toContain(index.latest_prompt)
    expect(result.content).toContain(index.latest_review)
    expect(result.content).toContain('study/state/mastery.json')
    expect(result.content).toContain('study/state/review-queue.json')
    expect(result.content).toContain('## 接下来先读')
    expect(result.content).not.toContain('"mission"')
  })

  it('writes a compact context file from temp state fixtures', () => {
    const studyRoot = createTempStudyRoot()
    writeJson(path.join(studyRoot, 'index.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-29T09:00:00+08:00',
      latest_daily: 'study/daily/2026-06-29.json',
      latest_prompt: 'study/prompts/generated/2026-06-29-review.md',
      latest_review: 'study/reviews/2026-06-28-review.json',
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
    writeJson(path.join(studyRoot, 'state', 'current.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-29T09:00:00+08:00',
      current_lesson: 7,
      learning_mode: 'foundation_rebuild',
      active_goals: ['稳住第 7 课', '为受控输出做准备'],
      weakness_summary: [],
      recent_focus: {
        grammar: ['N で V'],
        listening: ['第 7 课关键词听辨'],
        speaking: ['受控短句输出']
      },
      next_recommendation: {
        date: '2026-06-29',
        plan_type: 'review_then_output',
        minutes: 45
      }
    })
    writeJson(path.join(studyRoot, 'state', 'mastery.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-29T09:00:00+08:00',
      current_gate: 'lesson-7-foundation',
      lesson_states: {
        'lesson-7': {
          lesson: 7,
          status: 'learning',
          skill_scores: {
            grammar: 0.3,
            listening: 0.2,
            speaking: 0.2,
            reading: 0.4
          },
          last_reviewed_at: '2026-06-28T20:00:00+08:00'
        }
      },
      grammar_points: {
        'lesson-7/tool-means': {
          lesson: 7,
          pattern: 'N で V',
          status: 'weak',
          recognition: 0.4,
          controlled_output: 0.1,
          free_output: 0,
          last_practiced_at: '2026-06-28T20:00:00+08:00'
        }
      }
    })
    writeJson(path.join(studyRoot, 'state', 'review-queue.json'), {
      schema_version: 1,
      revision: 1,
      updated_at: '2026-06-29T09:00:00+08:00',
      items: [
        {
          id: 'rq-001',
          kind: 'grammar_point',
          key: 'lesson-7/tool-means',
          status: 'due',
          due_date: '2026-06-29',
          interval_days: 1,
          ease: 2.1,
          last_result: 'wrong'
        }
      ]
    })
    fs.writeFileSync(
      path.join(studyRoot, 'logs', 'agent-events.jsonl'),
      '{"event_id":"e1","time":"2026-06-28T21:00:00+08:00","actor":"codex","event":"daily_packet_created","input_files":["study/index.json"],"output_files":["study/daily/2026-06-29.json"],"summary":"Created daily packet."}\n',
      'utf8'
    )

    const writer = createAgentStudyContextWriter({ studyRoot })
    const result = writer.writeNextAgentContext()
    const written = fs.readFileSync(path.join(studyRoot, 'context', 'next-agent-context.md'), 'utf8')

    expect(result.content).toEqual(written)
    expect(written).toContain('study/daily/2026-06-29.json')
    expect(written).toContain('study/reviews/2026-06-28-review.json')
    expect(written).toContain('lesson-7/tool-means')
    expect(written).toContain('## 接下来先读')
  })
})
