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
        summary: '今天先稳住复习节奏，再用口头输出巩固重点。',
        focus_notes: ['先听后说', '优先复习第 3 课和第 4 课'],
        speaking_prompts: ['请用日语说三句你今天正在做的学习任务。'],
        listening_prompts: ['听一段课文并复述关键词。'],
        review_reminders: ['结束前复盘一个最容易出错的点。']
      })
    )

    const result = await handleDailyPlanEnhancement(payload, { requestLlm })

    expect(result).toEqual({
      summary: '今天先稳住复习节奏，再用口头输出巩固重点。',
      focus_notes: ['先听后说', '优先复习第 3 课和第 4 课'],
      speaking_prompts: ['请用日语说三句你今天正在做的学习任务。'],
      listening_prompts: ['听一段课文并复述关键词。'],
      review_reminders: ['结束前复盘一个最容易出错的点。']
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

  it('falls back to deterministic summary when LLM returns non-JSON text', async () => {
    const requestLlm = vi.fn(async () => 'Let me analyze the plan before formatting anything.')

    const result = await handleDailyPlanEnhancement(payload, { requestLlm })

    expect(result.summary).toContain('今天围绕')
    expect(result.focus_notes.length).toBeGreaterThan(0)
    expect(result.speaking_prompts.length).toBeGreaterThan(0)
    expect(result.listening_prompts.length).toBeGreaterThan(0)
    expect(result.review_reminders.length).toBeGreaterThan(0)
  })

  it('falls back to deterministic summary when parsed JSON is missing summary', async () => {
    const requestLlm = vi.fn(async () =>
      JSON.stringify({
        focus_notes: ['note only'],
        speaking_prompts: ['speak'],
        listening_prompts: ['listen'],
        review_reminders: ['review']
      })
    )

    const result = await handleDailyPlanEnhancement(payload, { requestLlm })

    expect(result.summary).toContain('今天围绕')
    expect(result.focus_notes.length).toBeGreaterThan(0)
  })
})
