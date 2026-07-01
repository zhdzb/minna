import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AgentStudyWorkspace from '../src/components/AgentStudyWorkspace.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createDailyPacket = (overrides = {}) => ({
  id: 'daily-2026-06-26',
  date: '2026-06-26',
  revision: 2,
  status: 'planned',
  mission: {
    title: '第 7 课基础重建',
    goals: ['复习授受动词', '完成简短输出'],
    available_minutes: 60,
    focus_lessons: [7]
  },
  tasks: [{ id: 'task-1', title: '复习语法', type: 'grammar_review', minutes: 15, status: 'pending' }],
  study_materials: [
    {
      id: 'material-1',
      title: '授受动词笔记',
      type: 'grammar_note',
      lesson: 7,
      content: '简短学习笔记。',
      examples: [{ ja: 'せんせいに ほんを あげます', zh: '给老师一本书' }]
    }
  ],
  exercises: [
    {
      id: 'exercise-fill',
      prompt: '第 1 题：按要求完成句型填空',
      type: 'q_fill',
      lesson: 7,
      target_grammar: 'N に V',
      instruction: '请补全句子：せんせい ___ ほんを あげます。',
      context_note: '请只填写一个最合适的助词。',
      answer_format: '只填写一个选项，不要写完整句子。',
      choices: ['に', 'で', 'を', 'と'],
      metadata: { skill: 'grammar' },
      vocab_hints: ['に']
    },
    {
      id: 'exercise-translate',
      prompt: '第 2 题：把中文意思说成日语',
      type: 'q_translate',
      lesson: 7,
      target_grammar: 'N1 は N2 に あげます',
      instruction: '把“我给老师发资料”说成日语。',
      context_note: '请用完整句子表达，明确谁给谁什么。',
      answer_format: '写 1 句完整、自然的日语句子。',
      metadata: { skill: 'output' },
      vocab_hints: ['老师', '书']
    },
    {
      id: 'exercise-conversation',
      prompt: '第 3 题：根据情境完成你的回应',
      type: 'q_conversation',
      lesson: 7,
      target_grammar: 'N1 は N2 に もらいます',
      instruction: '你是 B，请回答“那本书是谁给你的？”',
      context_note: '只需要补 B 的一句回答，不要扩写成长段落。',
      answer_format: '只写你这一轮的回答，1 句即可。',
      supporting_lines: ['A：その ほんは だれに もらいましたか。', 'B：（此处由你作答）'],
      metadata: { skill: 'conversation' },
      vocab_hints: ['朋友']
    }
  ],
  review_items: [{ review_queue_id: 'rq-1' }],
  correction: { status: 'pending' },
  answers: {
    'exercise-fill': '',
    'exercise-translate': '',
    'exercise-conversation': ''
  },
  self_assessment: {
    difficulty: null,
    uncertain_exercise_ids: [],
    confusing_points: [],
    pace: '',
    note: ''
  },
  ...overrides
})

const createReviewResult = (overrides = {}) => ({
  id: 'review-2026-06-26',
  created_at: '2026-06-26T21:00:00+08:00',
  overall: {
    accuracy: 0.74,
    summary: '核心意思基本正确，但交通方式里的「で」还不稳定。',
    next_focus: ['N で V 交通方式句', '更自然的简短对话回复']
  },
  items: [
    {
      exercise_id: 'exercise-fill',
      is_correct: false,
      score: 0.25,
      error_tags: ['particle', 'grammar_pattern'],
      target_grammar: 'N で V',
      user_answer: 'に',
      correct_answer: 'で',
      explanation: '这里需要表示手段的「で」，不能用「に」。',
      retry_recommended: true,
      rubric: {
        target_particle: 0,
        pattern_match: 0.5
      },
      confidence: 0.97,
      needs_user_input: false,
      acceptable_variants: [],
      manual_override: null
    },
    {
      exercise_id: 'exercise-conversation',
      is_correct: true,
      score: 0.68,
      error_tags: ['naturalness'],
      target_grammar: 'N1 は N2 に もらいます',
      user_answer: 'ともだちに もらいました',
      correct_answer: 'ともだちに ほんを もらいましたよ',
      explanation: '答案正确，但作为对话回复略显单薄，可以补得更自然。',
      retry_recommended: true,
      rubric: {
        context_match: 0.7,
        politeness: 0.7,
        naturalness: 0.5
      },
      confidence: 0.63,
      needs_user_input: true,
      acceptable_variants: ['ともだちに ほんを もらいました'],
      manual_override: {
        reason: '老师认为这句可以理解，但下次要补成更完整的口语回复。'
      }
    }
  ],
  promotion_decision: {
    can_advance: false,
    reason: '第 7 课输出接近稳定，但「で」还需要再完成一轮正确输出。'
  },
  ...overrides
})

const createClient = (options = {}) => ({
  loadLatestAgentStudy: vi.fn().mockResolvedValue({
    index: {
      latest_review: 'study/reviews/2026-06-26-review.json'
    },
    dailyPacket: createDailyPacket(options.dailyPacket),
    reviewResult: options.reviewResult === undefined ? null : createReviewResult(options.reviewResult)
  }),
  saveDailyPacket: vi.fn().mockResolvedValue({
    dailyPacket: createDailyPacket({
      status: 'answering',
      answers: options.savedAnswers || {
        'exercise-fill': 'に',
        'exercise-translate': 'わたしは せんせいに ほんを あげます',
        'exercise-conversation': 'ともだちに もらいました'
      }
    }),
    targetPath: 'study/daily/2026-06-26.json'
  }),
  submitDailyPacket: vi.fn().mockResolvedValue({
    dailyPacket: createDailyPacket({
      status: 'submitted',
      answers: options.savedAnswers || {
        'exercise-fill': 'に',
        'exercise-translate': 'わたしは せんせいに ほんを あげます',
        'exercise-conversation': 'ともだちに もらいました'
      },
      self_assessment: {
        difficulty: 'steady',
        uncertain_exercise_ids: ['exercise-conversation'],
        confusing_points: ['ageru 和 morau 还会混'],
        pace: 'steady',
        note: '还想再看一眼授受动词。'
      },
      correction: {
        status: 'pending',
        prompt_file: 'study/prompts/generated/2026-06-26-review.md',
        review_file: ''
      }
    }),
    targetPath: 'study/daily/2026-06-26.json'
  }),
  generateDailyPacket: vi.fn().mockResolvedValue({
    dailyPacket: createDailyPacket({
      status: 'planned',
      correction: {
        status: 'pending',
        prompt_file: 'study/prompts/generated/2026-06-26-review.md',
        review_file: ''
      }
    }),
    reused: false
  }),
  loadPromptFile: vi.fn().mockResolvedValue({
    path: 'study/prompts/generated/2026-06-26-review.md',
    content: '批改提示词正文'
  })
})

const mountWorkspace = (client, options = {}) =>
  mount(AgentStudyWorkspace, {
    props: { client, ...(options.props || {}) },
    global: {
      stubs: {
        'el-button': {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template:
            '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>'
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
        },
        'el-input': {
          props: ['modelValue', 'type', 'rows', 'placeholder'],
          emits: ['update:modelValue'],
          template: `
            <input
              v-if="type !== 'textarea'"
              class="stub-input"
              :value="modelValue"
              :placeholder="placeholder"
              @input="$emit('update:modelValue', $event.target.value)"
            />
            <textarea
              v-else
              class="stub-textarea"
              :rows="rows"
              :value="modelValue"
              :placeholder="placeholder"
              @input="$emit('update:modelValue', $event.target.value)"
            />
          `
        }
      }
    }
  })

describe('AgentStudyWorkspace', () => {
  it('renders the latest daily packet mission, sections, and exercises', async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(client.loadLatestAgentStudy).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('第 7 课基础重建')
    expect(wrapper.text()).toContain('复习语法')
    expect(wrapper.text()).toContain('授受动词笔记')
    expect(wrapper.text()).toContain('把“我给老师发资料”说成日语')
    expect(wrapper.text()).toContain('对话上下文')
    expect(wrapper.text()).toContain('A：その ほんは だれに もらいましたか。')
    expect(wrapper.text()).toContain('study/reviews/2026-06-26-review.json')
  })

  it('renders the latest review summary and per-item feedback when review data exists', async () => {
    const client = createClient({
      dailyPacket: {
        status: 'reviewed',
        correction: {
          status: 'reviewed',
          prompt_file: 'study/prompts/generated/2026-06-26-review.md',
          review_file: 'study/reviews/2026-06-26-review.json'
        }
      },
      reviewResult: {}
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain('最近批改结果')
    expect(wrapper.text()).toContain('74%')
    expect(wrapper.text()).toContain('暂不推进')
    expect(wrapper.text()).toContain('核心意思基本正确')
    expect(wrapper.text()).toContain('N で V 交通方式句')
    expect(wrapper.text()).toContain('这里需要表示手段的「で」')
    expect(wrapper.text()).toContain('可接受变体')
    expect(wrapper.text()).toContain('需要补充信息')
    expect(wrapper.text()).toContain('老师认为这句可以理解')
    expect(wrapper.text()).toContain('target_particle')
  })

  it('generates today packet through the workspace action and reloads the latest payload', async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    expect(client.generateDailyPacket).toHaveBeenCalledTimes(1)
    expect(client.loadLatestAgentStudy).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('已生成新的今日学习包')
  })

  it('updates answers and saves them through the daily save client', async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    const inputs = wrapper.findAll('.stub-input')
    const textareas = wrapper.findAll('.stub-textarea')

    await inputs[0].setValue('に')
    await textareas[0].setValue('わたしは せんせいに ほんを あげます')
    await textareas[1].setValue('ともだちに もらいました')
    await wrapper.findAll('button')[2].trigger('click')
    await flushPromises()

    expect(client.saveDailyPacket).toHaveBeenCalledWith({
      dailyPacket: expect.objectContaining({
        revision: 2,
        status: 'answering',
        answers: {
          'exercise-fill': 'に',
          'exercise-translate': 'わたしは せんせいに ほんを あげます',
          'exercise-conversation': 'ともだちに もらいました'
        }
      })
    })
    expect(wrapper.text()).toContain('草稿已保存')
  })

  it('submits the packet with self assessment and shows the next review handoff', async () => {
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()

    const inputs = wrapper.findAll('.stub-input')
    const textareas = wrapper.findAll('.stub-textarea')

    await inputs[0].setValue('に')
    await wrapper.find('select.assessment-input').setValue('steady')
    await wrapper.find('input.assessment-input').setValue('steady')
    await textareas[0].setValue('わたしは せんせいに ほんを あげます')
    await textareas[1].setValue('ともだちに もらいました')
    await wrapper.find('textarea.assessment-input').setValue('ageru 和 morau 还会混')
    await wrapper.findAll('textarea.assessment-input')[1].setValue('还想再看一眼授受动词。')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.findAll('button')[3].trigger('click')
    await flushPromises()

    expect(client.submitDailyPacket).toHaveBeenCalledWith({
      dailyPacket: expect.objectContaining({
        revision: 2,
        status: 'submitted',
        answers: expect.objectContaining({
          'exercise-fill': 'に',
          'exercise-translate': 'わたしは せんせいに ほんを あげます',
          'exercise-conversation': 'ともだちに もらいました'
        }),
        self_assessment: {
          difficulty: 'steady',
          uncertain_exercise_ids: ['exercise-fill'],
          confusing_points: ['ageru 和 morau 还会混'],
          pace: 'steady',
          note: '还想再看一眼授受动词。'
        }
      })
    })
    expect(wrapper.text()).toContain('学习包已提交')
    expect(wrapper.text()).toContain('study/prompts/generated/2026-06-26-review.md')
  })

  it('loads and copies the review prompt after submission', async () => {
    const client = createClient()
    const copyText = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    await wrapper.findAll('button')[3].trigger('click')
    await flushPromises()
    await wrapper.findAll('button')[4].trigger('click')
    await flushPromises()

    expect(client.loadPromptFile).toHaveBeenCalledWith('study/prompts/generated/2026-06-26-review.md')
    expect(copyText).toHaveBeenCalledWith('批改提示词正文')
    expect(wrapper.text()).toContain('批改提示词已复制')
    expect(wrapper.text()).toContain('批改提示词正文')
  })

  it('shows a refresh prompt when draft save hits a revision conflict', async () => {
    const client = createClient()
    client.saveDailyPacket.mockRejectedValueOnce(new Error('Revision conflict detected'))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.find('.stub-input').setValue('に')
    await wrapper.findAll('button')[2].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('草稿保存失败')
    expect(wrapper.text()).toContain('请先刷新')
  })

  it('shows a refresh prompt when submit hits a revision conflict', async () => {
    const client = createClient()
    client.submitDailyPacket.mockRejectedValueOnce(new Error('Revision conflict detected'))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.findAll('button')[3].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('提交失败')
    expect(wrapper.text()).toContain('请先刷新')
  })

  it('shows a clear prompt hint when no generated review prompt is linked', async () => {
    const client = createClient({
      dailyPacket: {
        status: 'submitted',
        correction: {
          status: 'pending',
          prompt_file: '',
          review_file: ''
        }
      }
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain('当前学习包还没有关联生成好的批改提示词。')
  })

  it('renders an empty state when there is no daily packet', async () => {
    const client = {
      loadLatestAgentStudy: vi.fn().mockResolvedValue({
        index: null,
        dailyPacket: null,
        reviewResult: null
      }),
      saveDailyPacket: vi.fn(),
      submitDailyPacket: vi.fn(),
      loadPromptFile: vi.fn()
    }

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain('当前还没有可用的每日学习包。')
  })
})
