import { describe, expect, it, vi } from 'vitest'
import { handleDailyPlanEnhancement } from '../src/server/routes/dailyPlanRoute'

describe('dailyPlanRoute', () => {
  const payload = {
    plan: {
      available_minutes: 60,
      plan_type: 'foundation_review',
      focus_lessons: [3, 4],
      tasks: [
        { id: 't1', type: 'shadowing', title: 'Shadow 3 dialogs', minutes: 20, required: true },
        { id: 't2', type: 'pattern_drill', title: 'Drill key patterns', minutes: 25, required: true }
      ],
      completion_criteria: ['Finish required tasks']
    },
    context: {
      current_stage: 'foundation_rebuild',
      target_exam: 'N3',
      priority_skills: ['listening', 'speaking'],
      current_lesson: 22,
      active_review_lessons: [3, 4],
      recent_weak_patterns: ['pattern-a'],
      last_7_days_summary: {
        planned_minutes: 240,
        completed_minutes: 180,
        missed_tasks: 2
      },
      provider: 'gemini',
      prompt_version: 'plan-v1',
      apiKey: 'secret'
    }
  }

  it('returns structured daily plan enhancement JSON', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        summary: '今天先稳住复习节奏，再用口头输出巩固。',
        focus_notes: ['先听后说', '优先复习第3课和第4课'],
        speaking_prompts: ['用 ています 说三句今天在做的事'],
        listening_prompts: ['听一段课文并复述关键词'],
        review_reminders: ['结束前复盘一个易错点']
      })
    )

    const result = await handleDailyPlanEnhancement(payload, { requestLlm })

    expect(result).toEqual({
      summary: '今天先稳住复习节奏，再用口头输出巩固。',
      focus_notes: ['先听后说', '优先复习第3课和第4课'],
      speaking_prompts: ['用 ています 说三句今天在做的事'],
      listening_prompts: ['听一段课文并复述关键词'],
      review_reminders: ['结束前复盘一个易错点']
    })
    expect(requestLlm).toHaveBeenCalledTimes(1)
    expect(requestLlm.mock.calls[0][0].taskName).toBe('plan')
  })

  it('rejects invalid plan payloads before the LLM call', async () => {
    const requestLlm = vi.fn()

    await expect(
      handleDailyPlanEnhancement(
        {
          plan: {
            available_minutes: 0,
            tasks: []
          }
        },
        { requestLlm }
      )
    ).rejects.toThrow(/available_minutes/)

    expect(requestLlm).not.toHaveBeenCalled()
  })
})
