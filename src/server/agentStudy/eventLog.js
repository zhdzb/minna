import fs from 'fs'
import path from 'path'

const normalizeString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(label + ' must be a non-empty string')
  }

  return value.trim()
}

const normalizeStringArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(label + ' must be an array')
  }

  return value.map((item, index) => normalizeString(item, label + '[' + index + ']'))
}

const normalizeEventRecord = ({
  event_id,
  time,
  actor,
  event,
  input_files,
  output_files,
  summary
}) => ({
  event_id: normalizeString(event_id, 'eventLog.event_id'),
  time: normalizeString(time, 'eventLog.time'),
  actor: normalizeString(actor, 'eventLog.actor'),
  event: normalizeString(event, 'eventLog.event'),
  input_files: normalizeStringArray(input_files, 'eventLog.input_files'),
  output_files: normalizeStringArray(output_files, 'eventLog.output_files'),
  summary: normalizeString(summary, 'eventLog.summary')
})

const createEventId = ({ actor, event, time }) => {
  const compactTime = time.replace(/[^0-9]/g, '').slice(0, 14)
  const randomSuffix = Math.random().toString(36).slice(2, 8)
  return actor + '-' + event + '-' + compactTime + '-' + randomSuffix
}

const createAgentStudyEventLog = ({
  studyRoot = path.resolve(process.cwd(), 'study'),
  fsImpl = fs,
  now = () => new Date().toISOString(),
  createId = createEventId,
  logRelativePath = path.posix.join('study', 'logs', 'agent-events.jsonl')
} = {}) => {
  const resolveLogPath = () => {
    const relativeWithinStudy = logRelativePath.replace(/^study\//, '')
    return path.resolve(studyRoot, relativeWithinStudy)
  }

  const appendEvent = ({
    event_id,
    time,
    actor,
    event,
    input_files,
    output_files,
    summary
  }) => {
    const normalizedTime = typeof time === 'string' && time.trim() !== '' ? time.trim() : now()
    const normalizedActor = normalizeString(actor, 'eventLog.actor')
    const normalizedEvent = normalizeString(event, 'eventLog.event')

    const record = normalizeEventRecord({
      event_id: event_id || createId({ actor: normalizedActor, event: normalizedEvent, time: normalizedTime }),
      time: normalizedTime,
      actor: normalizedActor,
      event: normalizedEvent,
      input_files,
      output_files,
      summary
    })

    const logPath = resolveLogPath()
    fsImpl.mkdirSync(path.dirname(logPath), { recursive: true })
    fsImpl.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8')
    return record
  }

  const readRecentEvents = (limit = 20) => {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('eventLog limit must be a non-negative integer')
    }

    if (limit === 0) {
      return []
    }

    const logPath = resolveLogPath()
    if (!fsImpl.existsSync(logPath)) {
      return []
    }

    const lines = fsImpl
      .readFileSync(logPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const records = lines.map((line, index) => {
      try {
        return normalizeEventRecord(JSON.parse(line))
      } catch (error) {
        throw new Error('Failed to parse event log line ' + (index + 1) + ': ' + error.message)
      }
    })

    return records.slice(-limit)
  }

  return {
    appendEvent,
    readRecentEvents
  }
}

export { createAgentStudyEventLog }
