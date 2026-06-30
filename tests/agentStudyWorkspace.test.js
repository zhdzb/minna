import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AgentStudyWorkspace from '../src/components/AgentStudyWorkspace.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createClient = (payload) => ({
  loadLatestAgentStudy: vi.fn().mockResolvedValue(payload)
})

const mountWorkspace = (client) =>
  mount(AgentStudyWorkspace, {
    props: { client },
    global: {
      stubs: {
        'el-button': {
          template: '<button><slot /></button>'
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

describe('AgentStudyWorkspace', () => {
  it('renders the latest daily packet mission, tasks, materials, and exercises', async () => {
    const client = createClient({
      index: {
        latest_review: 'study/reviews/2026-06-26-review.json'
      },
      dailyPacket: {
        date: '2026-06-26',
        status: 'planned',
        mission: {
          title: '第 7 课基础重建',
          goals: ['复习授受表达', '完成基础输出']
        },
        tasks: [{ id: 'task-1', title: '复习语法', type: 'grammar_review', minutes: 15, status: 'pending' }],
        study_materials: [
          {
            id: 'material-1',
            title: '授受表达说明',
            type: 'grammar_note',
            lesson: 7,
            content: '说明内容',
            examples: [{ ja: '先生に本をあげます', zh: '给老师书' }]
          }
        ],
        exercises: [
          {
            id: 'exercise-1',
            prompt: '把句子翻成日语',
            type: 'q_translate',
            lesson: 7,
            target_grammar: 'N1 は N2 に あげます',
            metadata: { skill: 'output' },
            vocab_hints: ['先生', '本']
          }
        ],
        review_items: [{ review_queue_id: 'rq-1' }],
        correction: { status: 'pending' }
      },
      reviewResult: null
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(client.loadLatestAgentStudy).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('第 7 课基础重建')
    expect(wrapper.text()).toContain('复习语法')
    expect(wrapper.text()).toContain('授受表达说明')
    expect(wrapper.text()).toContain('把句子翻成日语')
    expect(wrapper.text()).toContain('study/reviews/2026-06-26-review.json')
  })

  it('renders an empty state when there is no daily packet', async () => {
    const client = createClient({
      index: null,
      dailyPacket: null,
      reviewResult: null
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain('当前还没有可用的学习包。')
  })
})
