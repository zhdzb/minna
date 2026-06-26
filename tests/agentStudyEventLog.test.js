import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentStudyEventLog } from '../src/server/agentStudy/eventLog'

const tempDirs = []

const createTempStudyRoot = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-study-events-'))
  tempDirs.push(tempRoot)
  const studyRoot = path.join(tempRoot, 'study')
  fs.mkdirSync(path.join(studyRoot, 'logs'), { recursive: true })
  return studyRoot
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('agentStudyEventLog', () => {
  it('appends multiple events as parseable JSONL records without overwriting history', () => {
    const studyRoot = createTempStudyRoot()
    let counter = 0
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      now: () => '2026-06-26T10:00:0' + counter + '+08:00',
      createId: ({ actor, event, time }) => {
        counter += 1
        return actor + '-' + event + '-' + counter + '-' + time.slice(17, 19)
      }
    })

    const first = eventLog.appendEvent({
      actor: 'codex',
      event: 'daily_saved',
      input_files: ['study/index.json'],
      output_files: ['study/daily/2026-06-26.json'],
      summary: 'Saved the daily packet draft.'
    })
    const second = eventLog.appendEvent({
      actor: 'frontend',
      event: 'daily_submitted',
      input_files: ['study/daily/2026-06-26.json'],
      output_files: ['study/logs/agent-events.jsonl'],
      summary: 'Submitted the daily packet.'
    })

    const logPath = path.join(studyRoot, 'logs', 'agent-events.jsonl')
    const lines = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/)

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual(first)
    expect(JSON.parse(lines[1])).toEqual(second)
  })

  it('reads the most recent events in chronological order', () => {
    const studyRoot = createTempStudyRoot()
    const eventLog = createAgentStudyEventLog({
      studyRoot,
      createId: ({ actor, event, time }) => actor + '-' + event + '-' + time.slice(11, 19)
    })

    eventLog.appendEvent({
      time: '2026-06-26T09:00:00+08:00',
      actor: 'codex',
      event: 'seed_initialized',
      input_files: ['data.json'],
      output_files: ['study/index.json'],
      summary: 'Initialized seed data.'
    })
    eventLog.appendEvent({
      time: '2026-06-26T10:00:00+08:00',
      actor: 'frontend',
      event: 'daily_saved',
      input_files: ['study/daily/2026-06-26.json'],
      output_files: ['study/logs/agent-events.jsonl'],
      summary: 'Saved answers.'
    })
    eventLog.appendEvent({
      time: '2026-06-26T11:00:00+08:00',
      actor: 'frontend',
      event: 'daily_submitted',
      input_files: ['study/daily/2026-06-26.json'],
      output_files: ['study/logs/agent-events.jsonl'],
      summary: 'Submitted answers.'
    })

    const recent = eventLog.readRecentEvents(2)

    expect(recent).toHaveLength(2)
    expect(recent.map((item) => item.event)).toEqual(['daily_saved', 'daily_submitted'])
    expect(recent[0].time).toBe('2026-06-26T10:00:00+08:00')
    expect(recent[1].time).toBe('2026-06-26T11:00:00+08:00')
  })

  it('returns an empty list for missing logs and rejects malformed lines', () => {
    const studyRoot = createTempStudyRoot()
    const eventLog = createAgentStudyEventLog({ studyRoot })

    expect(eventLog.readRecentEvents(5)).toEqual([])

    const logPath = path.join(studyRoot, 'logs', 'agent-events.jsonl')
    fs.writeFileSync(logPath, '{"event_id":"ok","time":"2026-06-26T00:00:00+08:00","actor":"codex","event":"ok","input_files":[],"output_files":[],"summary":"ok"}\nnot-json\n', 'utf8')

    expect(() => eventLog.readRecentEvents(5)).toThrow(/Failed to parse event log line 2/)
  })
})
