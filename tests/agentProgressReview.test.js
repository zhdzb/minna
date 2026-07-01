import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AgentProgressReview from '../src/components/AgentProgressReview.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createClient = () => ({
  loadProgressReview: vi.fn().mockResolvedValue({
    index: {
      latest_review: 'study/reviews/2026-06-26-review.json'
    },
    profile: {
      learner_id: 'learner-001',
      goals: ['重建第 7 课输出', '提高口语自信'],
      daily_time_budget_minutes: 45,
      pace_preference: 'steady',
      input_preferences: {
        allow_romaji: false,
        prefer_kana_first: true,
        practice_kanji: true
      },
      material_scope: {
        series: '大家的日本语',
        current_focus_lessons: [7],
        allow_new_lessons: false
      }
    },
    current: {
      current_lesson: 7,
      learning_mode: 'foundation_rebuild'
    },
    mastery: {
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
          }
        }
      },
      grammar_points: {
        'lesson-7/tool-means': {
          lesson: 7,
          pattern: 'N で V',
          status: 'weak',
          controlled_output: 0.15,
          free_output: 0.05
        }
      }
    },
    reviewQueue: {
      items: [
        {
          id: 'rq-001',
          key: 'lesson-7/tool-means',
          status: 'due',
          due_date: '2026-06-30',
          last_result: 'wrong',
          interval_days: 1,
          ease: 2.1
        }
      ]
    },
    reviewResult: {
      id: 'review-2026-06-26',
      overall: {
        accuracy: 0.74,
        summary: '交通方式里的「で」还需要再过一轮。',
        next_focus: ['N で V 交通方式句']
      },
      promotion_decision: {
        can_advance: false,
        reason: '「で」的使用还不稳定，先留在第 7 课。'
      }
    },
    recentEvents: [
      {
        event_id: 'event-1',
        actor: 'codex',
        event: 'review_applied',
        time: '2026-06-30T09:10:00+08:00',
        summary: '已应用最新批改结果。'
      }
    ],
    nextAgentContext: {
      path: 'study/context/next-agent-context.md',
      content: '# 下一次 Agent 上下文\n- 先读 study/state/current.json。\n'
    }
  })
})

const mountProgressReview = (client) =>
  mount(AgentProgressReview, {
    props: { client },
    global: {
      stubs: {
        'el-button': {
          props: ['loading'],
          emits: ['click'],
          template: '<button :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
        },
        'el-skeleton': {
          template: '<div class="stub-skeleton"></div>'
        },
        'el-alert': {
          props: ['title', 'description'],
          template: '<div class="stub-alert">{{ title }} {{ description }}</div>'
        },
        'el-empty': {
          props: ['description'],
          template: '<div class="stub-empty">{{ description }}</div>'
        },
        'el-tag': {
          template: '<span><slot /></span>'
        }
      }
    }
  })

describe('AgentProgressReview', () => {
  it('renders learner progress, mastery, queue, events, and next context', async () => {
    const client = createClient()
    const wrapper = mountProgressReview(client)
    await flushPromises()

    expect(client.loadProgressReview).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('进度总览')
    expect(wrapper.text()).toContain('learner-001')
    expect(wrapper.text()).toContain('重建第 7 课输出')
    expect(wrapper.text()).toContain('lesson-7-foundation')
    expect(wrapper.text()).toContain('lesson-7/tool-means')
    expect(wrapper.text()).toContain('先留在第 7 课')
    expect(wrapper.text()).toContain('review_applied')
    expect(wrapper.text()).toContain('study/context/next-agent-context.md')
    expect(wrapper.text()).toContain('先读 study/state/current.json')
  })

  it('shows an error state when the progress payload fails to load', async () => {
    const client = {
      loadProgressReview: vi.fn().mockRejectedValue(new Error('progress route unavailable'))
    }
    const wrapper = mountProgressReview(client)
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('progress route unavailable')
  })
})
