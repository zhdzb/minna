import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AgentReviewDrill from '../src/components/AgentReviewDrill.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createProgressPayload = () => ({
  current: {
    current_lesson: 7,
    learning_mode: 'foundation_rebuild'
  },
  reviewQueue: {
    items: [
      {
        id: 'rq-lesson-7-tool-means',
        kind: 'grammar_point',
        key: 'lesson-7/tool-means',
        status: 'due',
        due_date: '2026-06-30',
        interval_days: 1,
        ease: 2.1,
        last_result: 'wrong'
      }
    ]
  },
  reviewResult: {
    id: 'review-2026-06-26',
    overall: {
      accuracy: 0.74
    }
  }
})

const createReviewDrill = ({ status = 'draft', revision = 1 } = {}) => ({
  schema_version: 1,
  revision,
  updated_at: '2026-06-30T09:00:00+08:00',
  id: 'review-drill-2026-06-30',
  date: '2026-06-30',
  status,
  created_at: '2026-06-30T09:00:00+08:00',
  source_review: 'study/reviews/2026-06-26-review.json',
  summary: {
    title: '第 7 课薄弱点回炉',
    focus: ['交通方式里的「で」', 'もらう 短回复自然度'],
    due_review_queue_ids: ['rq-lesson-7-tool-means']
  },
  items: [
    {
      id: 'drill-001',
      review_queue_id: 'rq-lesson-7-tool-means',
      key: 'lesson-7/tool-means',
      lesson: 7,
      target_grammar: 'N で V',
      weakness_explanation: '最近一次批改里，交通方式句仍然会把「で」和其他助词混淆。',
      error_tags: ['particle', 'grammar_pattern'],
      original_prompt: '翻译：我坐公交车去。',
      variant_prompt: '请用日语表达：我今天坐出租车去车站。',
      answer_reference: 'きょうは タクシーで 駅へ 行きます。',
      user_answer: '',
      hint: '先把交通工具和「で」连起来，再完成移动句。',
      status: 'pending'
    }
  ],
  submission: {
    submitted_at: null,
    note: ''
  }
})

const createClient = (overrides = {}) => ({
  loadProgressReview: vi.fn().mockResolvedValue(createProgressPayload()),
  loadLatestReviewDrill: vi.fn().mockResolvedValue(createReviewDrill()),
  saveReviewDrill: vi.fn().mockImplementation(async ({ reviewDrill }) => ({
    reviewDrill: {
      ...reviewDrill,
      revision: reviewDrill.revision + 1
    },
    targetPath: 'study/review-drills/2026-06-30.json'
  })),
  submitReviewDrill: vi.fn().mockImplementation(async ({ reviewDrill }) => ({
    reviewDrill: {
      ...reviewDrill,
      revision: reviewDrill.revision + 1,
      status: 'submitted',
      submission: {
        ...reviewDrill.submission,
        submitted_at: '2026-06-30T12:00:00+08:00'
      },
      items: reviewDrill.items.map((item) => ({
        ...item,
        status: 'submitted'
      }))
    },
    targetPath: 'study/review-drills/2026-06-30.json'
  })),
  ...overrides
})

const mountDrill = (client) =>
  mount(AgentReviewDrill, {
    props: { client },
    global: {
      stubs: {
        'el-button': {
          props: ['loading', 'type'],
          emits: ['click'],
          template: '<button :data-type="type" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
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

describe('AgentReviewDrill', () => {
  it('renders structured review drill items', async () => {
    const client = createClient()
    const wrapper = mountDrill(client)
    await flushPromises()

    expect(client.loadProgressReview).toHaveBeenCalledTimes(1)
    expect(client.loadLatestReviewDrill).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('结构化训练包')
    expect(wrapper.text()).toContain('lesson-7 / tool-means')
    expect(wrapper.text()).toContain('最近一次批改里，交通方式句仍然会把「で」')
    expect(wrapper.text()).toContain('请用日语表达：我今天坐出租车去车站。')
    expect(wrapper.text()).not.toContain('きょうは タクシーで 駅へ 行きます。')
    expect(wrapper.text()).toContain('提交训练后显示参考答案。')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('saves and submits review drill answers', async () => {
    const client = createClient()
    const wrapper = mountDrill(client)
    await flushPromises()

    await wrapper.find('textarea').setValue('きょうは タクシーで 駅へ 行きます。')

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await flushPromises()

    expect(client.saveReviewDrill).toHaveBeenCalledTimes(1)
    expect(client.saveReviewDrill.mock.calls[0][0].reviewDrill.items[0].user_answer).toBe(
      'きょうは タクシーで 駅へ 行きます。'
    )
    expect(wrapper.text()).toContain('复习训练草稿已保存。')

    await buttons[1].trigger('click')
    await flushPromises()

    expect(client.submitReviewDrill).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('复习训练答案已成功提交。')
    expect(wrapper.text()).toContain('submitted')
  })

  it('shows an empty state when no review drill packet exists', async () => {
    const client = createClient({
      loadLatestReviewDrill: vi.fn().mockResolvedValue(null)
    })
    const wrapper = mountDrill(client)
    await flushPromises()

    expect(wrapper.text()).toContain('当前还没有可用的复习训练包。')
  })
})
