import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('Listening Lab component', () => {
  it('contains the gated five-stage flow, recording and independent history views', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'ListeningLab.vue'),
      'utf8'
    )

    expect(source).toContain('盲听理解')
    expect(source).toContain('对照阅读')
    expect(source).toContain('分段影子跟读')
    expect(source).toContain('职场应答')
    expect(source).toContain('训练反馈')
    expect(source).toContain('MediaRecorder')
    expect(source).toContain('submitAttempt')
    expect(source).toContain('历史记录')
    expect(source).not.toContain('createAgentStudyClient')
  })
})
