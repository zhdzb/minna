import { describe, expect, it, vi } from 'vitest'
import { handleWeeklySummary } from '../src/server/routes/weeklySummaryRoute'

describe('weeklySummaryRoute', () => {
  it('returns structured weekly summary json', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        overview: '本周执行稳定，但口头输出还需要加强。',
        achievements: ['完成了4天学习计划'],
        risks: ['周中有两次任务中断'],
        next_week_focus: ['每天先做10分钟跟读'],
        speaking_tasks: ['每天用目标语法造句3句'],
        listening_tasks: ['每天听课文并复述关键词']
      })
    )

    const result = await handleWeeklySummary(
      {
        context: {
          current_stage: 'foundation_rebuild',
          target_exam: 'N3',
          priority_skills: ['listening', 'speaking'],
          current_lesson: 22
        },
        weekly_stats: {
          planned_minutes: 360,
          completed_minutes: 270,
          missed_tasks: 3,
          completed_days: 4,
          total_days: 7
        },
        completed_plans: {
          total: 2,
          partial: 1
        },
        skipped_tasks: [{ id: 'task_2', title: 'shadowing' }],
        mastery_changes: [{ entity: 'lesson', key: '6' }],
        recent_mistakes: [{ id: 'm1', grammar_point: 'N が あります' }]
      },
      { requestLlm }
    )

    expect(result.overview).toBe('本周执行稳定，但口头输出还需要加强。')
    expect(result.speaking_tasks).toHaveLength(1)
    expect(requestLlm).toHaveBeenCalledTimes(1)
    expect(requestLlm.mock.calls[0][0].taskName).toBe('summary')
    expect(requestLlm.mock.calls[0][0].userPrompt).toMatch(/Completed plans:/)
    expect(requestLlm.mock.calls[0][0].userPrompt).toMatch(/Mastery changes:/)
  })

  it('rejects missing weekly stats before calling LLM', async () => {
    const requestLlm = vi.fn()

    await expect(
      handleWeeklySummary(
        {
          context: {}
        },
        { requestLlm }
      )
    ).rejects.toThrow(/weekly_stats/)

    expect(requestLlm).not.toHaveBeenCalled()
  })
})
