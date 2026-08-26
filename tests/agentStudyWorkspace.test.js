import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgentStudyWorkspace from '../src/components/AgentStudyWorkspace.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

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
      error_tags: ['particle', 'grammar_pattern', 'vocabulary'],
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
      vocabulary_feedback: [{ dictionary_form: 'のむ', meaning: '喝' }],
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
    reviewResult: options.reviewResult === undefined ? null : createReviewResult(options.reviewResult),
    phase: options.phase
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
        },
        'el-collapse': {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<div class="stub-collapse"><slot /></div>'
        },
        'el-collapse-item': {
          props: ['name'],
          data() {
            return { isOpen: true }
          },
          template: `
            <section class="stub-collapse-item" :data-open="isOpen">
              <button type="button" :data-collapse-toggle="name" @click="isOpen = !isOpen"><slot name="title" /></button>
              <div v-show="isOpen" class="stub-collapse-content"><slot /></div>
            </section>
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
    expect(wrapper.text()).toContain('当前包批改')
    expect(wrapper.text()).toContain('尚未批改')
    expect(wrapper.text()).not.toContain('study/reviews/2026-06-26-review.json')
  })

  it('keeps study sections expanded by default and collapses them without losing drafts', async () => {
    const wrapper = mountWorkspace(createClient())
    await flushPromises()

    const exerciseItem = wrapper
      .findAll('.stub-collapse-item')
      .find((item) => item.find('[data-collapse-toggle="exercises"]').exists())
    const fillInput = wrapper.find('.stub-input')
    await fillInput.setValue('に')
    expect(exerciseItem.attributes('data-open')).toBe('true')

    await wrapper.find('[data-collapse-toggle="exercises"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(exerciseItem.attributes('data-open')).toBe('false')

    await wrapper.find('[data-collapse-toggle="exercises"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(exerciseItem.attributes('data-open')).toBe('true')
    expect(wrapper.find('.stub-input').element.value).toBe('に')
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
    expect(wrapper.text()).toContain('词汇订正')
    expect(wrapper.text()).toContain('辞书形：のむ（喝）')

    const reviewCards = wrapper.findAll('.review-item-card')
    expect(reviewCards[0].text()).toContain('原题')
    expect(reviewCards[0].text()).toContain('请补全句子：せんせい ___ ほんを あげます。')
    expect(reviewCards[0].text()).toContain('只填写一个选项')
    expect(reviewCards[1].text()).toContain('A：その ほんは だれに もらいましたか。')
  })

  it('shows review feedback in three-item batches and persists reading actions', async () => {
    const baseDaily = createDailyPacket()
    const baseReview = createReviewResult()
    const exercises = Array.from({ length: 5 }, (_, index) => ({
      ...baseDaily.exercises[0],
      id: `exercise-${index + 1}`,
      prompt: `第 ${index + 1} 题`
    }))
    const items = exercises.map((exercise, index) => ({
      ...baseReview.items[0],
      exercise_id: exercise.id,
      target_grammar: `语法 ${index + 1}`
    }))
    const client = createClient({
      dailyPacket: {
        status: 'reviewed',
        exercises,
        answers: Object.fromEntries(exercises.map((exercise) => [exercise.id, '答案'])),
        correction: {
          status: 'reviewed',
          review_file: 'study/reviews/2026-06-26-review.json'
        }
      },
      reviewResult: { items }
    })
    client.loadReviewReading = vi.fn().mockResolvedValue({ reviews: {} })
    client.loadMistakes = vi.fn().mockResolvedValue({ items: [] })
    client.updateReviewReading = vi.fn().mockResolvedValue({
      reviews: {
        'review-2026-06-26': {
          last_exercise_id: 'exercise-1',
          items: {
            'exercise-1': { status: 'read', updated_at: '2026-08-26T10:00:00+08:00' }
          }
        }
      }
    })

    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.findAll('.review-item-card')).toHaveLength(3)
    const understood = wrapper.findAll('button').find((button) => button.text().includes('已看懂'))
    await understood.trigger('click')
    await flushPromises()

    expect(client.updateReviewReading).toHaveBeenCalledWith({
      reviewId: 'review-2026-06-26',
      reviewFile: 'study/reviews/2026-06-26-review.json',
      exerciseId: 'exercise-1',
      status: 'read'
    })
    expect(wrapper.text()).toContain('已读 1/5')
  })

  it('manually adds a daily exercise to the mistake book', async () => {
    const client = createClient()
    client.loadMistakes = vi.fn().mockResolvedValue({ items: [] })
    client.addManualMistake = vi.fn().mockResolvedValue({
      mistakeBook: {
        items: [{
          id: 'mistake:daily-2026-06-26:exercise-fill',
          daily_id: 'daily-2026-06-26',
          exercise_id: 'exercise-fill',
          status: 'active'
        }]
      }
    })
    client.setMistakeStatus = vi.fn()

    const wrapper = mountWorkspace(client)
    await flushPromises()
    const addButton = wrapper.findAll('button').find((button) => button.text().includes('加入错题'))
    await addButton.trigger('click')
    await flushPromises()

    expect(client.addManualMistake).toHaveBeenCalledWith({
      exerciseId: 'exercise-fill',
      dailyPath: undefined,
      reviewPath: 'study/reviews/2026-06-26-review.json'
    })
    expect(wrapper.text()).toContain('移出错题本')
  })

  it('copies the create-daily prompt instead of generating a packet in the browser', async () => {
    const client = createClient({
      phase: 'ready_for_next',
      dailyPacket: {
        status: 'reviewed',
        correction: { status: 'reviewed', review_file: 'study/reviews/2026-06-26-review.json' }
      }
    })
    const copyText = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    await wrapper.find('[data-action="phase-primary"]').trigger('click')
    await flushPromises()

    expect(client.loadLatestAgentStudy).toHaveBeenCalledTimes(1)
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('生成今日学习包'))
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('不要调用前端 LLM 出题逻辑'))
    expect(wrapper.text()).toContain('生成学习包提示词已复制')
  })

  it('copies a state-validated continuation prompt for a fresh Codex context', async () => {
    const client = createClient()
    const copyText = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    await wrapper.find('[data-action="copy-continuation"]').trigger('click')
    await flushPromises()

    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('接续当前学习流程'))
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('continue-agent-study.md'))
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('observed phase: studying'))
    expect(wrapper.text()).toContain('接续指令已复制')
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
    await wrapper.find('[data-action="save-daily"]').trigger('click')
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

  it('keeps the caret in the middle after converting romaji to kana', async () => {
    vi.stubGlobal('wanakana', {
      toKana: (value) => value.replaceAll('ka', 'か')
    })
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()
    document.body.appendChild(wrapper.element)

    const textarea = wrapper.findAll('.stub-textarea')[0]
    textarea.element.focus()
    textarea.element.value = 'あkaい'
    textarea.element.setSelectionRange(3, 3)
    await textarea.trigger('input')
    await flushPromises()

    expect(textarea.element.value).toBe('あかい')
    expect(textarea.element.selectionStart).toBe(2)
    expect(textarea.element.selectionEnd).toBe(2)
  })

  it('keeps unfinished romaji intact until the middle-of-sentence syllable is complete', async () => {
    vi.stubGlobal('wanakana', {
      toKana: (value) => value.replaceAll('na', 'な').replaceAll('ni', 'に')
    })
    const client = createClient()
    const wrapper = mountWorkspace(client)
    await flushPromises()
    document.body.appendChild(wrapper.element)

    const textarea = wrapper.findAll('.stub-textarea')[0]
    textarea.element.focus()
    textarea.element.value = 'あnaka'
    textarea.element.setSelectionRange(2, 2)
    await textarea.trigger('input')
    await flushPromises()

    expect(textarea.element.value).toBe('あnaka')
    expect(textarea.element.selectionStart).toBe(2)

    textarea.element.value = 'あniaka'
    textarea.element.setSelectionRange(3, 3)
    await textarea.trigger('input')
    await flushPromises()

    expect(textarea.element.value).toBe('あにaka')
    expect(textarea.element.selectionStart).toBe(2)
  })

  it('plays listening exercises without exposing the transcript', async () => {
    const speak = vi.fn()
    const cancel = vi.fn()
    class TestUtterance {
      constructor (text) {
        this.text = text
      }
    }
    vi.stubGlobal('speechSynthesis', { speak, cancel })
    vi.stubGlobal('SpeechSynthesisUtterance', TestUtterance)

    const audioText = 'かいぎは くじからです。'
    const client = createClient({
      dailyPacket: {
        exercises: [
          {
            id: 'exercise-listening',
            prompt: '听取会议时间并回答',
            type: 'q_listening',
            lesson: 7,
            target_grammar: 'time から',
            instruction: '点击播放后，用日语回答会议时间。',
            context_note: '听力原文不会显示。',
            answer_format: '写 1 句自然日语。',
            supporting_lines: [],
            metadata: { skill: 'listening', audio_text: audioText },
            vocab_hints: []
          }
        ],
        answers: { 'exercise-listening': '' },
        review_items: []
      }
    })
    const wrapper = mountWorkspace(client)
    await flushPromises()

    expect(wrapper.text()).toContain('播放听力')
    expect(wrapper.text()).not.toContain(audioText)
    await wrapper.find('.speech-rate-control select').setValue('0.75')
    const playButton = wrapper.findAll('button').find((button) => button.text().includes('播放听力'))
    await playButton.trigger('click')

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: audioText,
      lang: 'ja-JP',
      rate: 0.75
    })
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
    await wrapper.find('[data-action="submit-daily"]').trigger('click')
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
    expect(wrapper.text()).toContain('交给 Codex 批改')
    expect(wrapper.text()).toContain('本次答案摘要')
  })

  it('builds and copies the review handoff prompt after submission', async () => {
    const client = createClient()
    const copyText = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    const inputs = wrapper.findAll('.stub-input')
    const textareas = wrapper.findAll('.stub-textarea')
    await inputs[0].setValue('は')
    await textareas[0].setValue('わたしは せんせいに ほんを あげます')
    await textareas[1].setValue('ともだちに もらいました')
    await wrapper.find('select.assessment-input').setValue('steady')
    await wrapper.find('[data-action="submit-daily"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-action="copy-review"]').trigger('click')
    await flushPromises()

    expect(client.loadPromptFile).not.toHaveBeenCalled()
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('批改已提交学习包'))
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('study/daily/2026-06-26.json'))
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('わたしは せんせいに ほんを あげます'))
    expect(wrapper.text()).toContain('批改提示词已复制')
    expect(wrapper.text()).toContain('批改已提交学习包')
  })

  it('shows a refresh prompt when draft save hits a revision conflict', async () => {
    const client = createClient()
    client.saveDailyPacket.mockRejectedValueOnce(new Error('Revision conflict detected'))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    await wrapper.find('.stub-input').setValue('に')
    await wrapper.find('[data-action="save-daily"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('草稿保存失败')
    expect(wrapper.text()).toContain('请先刷新')
  })

  it('shows a refresh prompt when submit hits a revision conflict', async () => {
    const client = createClient()
    client.submitDailyPacket.mockRejectedValueOnce(new Error('Revision conflict detected'))

    const wrapper = mountWorkspace(client)
    await flushPromises()

    const inputs = wrapper.findAll('.stub-input')
    const textareas = wrapper.findAll('.stub-textarea')
    await inputs[0].setValue('は')
    await textareas[0].setValue('わたしは せんせいに ほんを あげます')
    await textareas[1].setValue('ともだちに もらいました')
    await wrapper.find('select.assessment-input').setValue('steady')
    await wrapper.find('[data-action="submit-daily"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('提交失败')
    expect(wrapper.text()).toContain('请先刷新')
  })

  it('shows a review handoff even when no generated review prompt is linked', async () => {
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

    expect(wrapper.text()).toContain('交给 Codex 批改')
    expect(wrapper.text()).toContain('study/prompts/generated/YYYY-MM-DD-review.md')
  })

  it('renders an empty state with a Codex create prompt when there is no daily packet', async () => {
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
    const copyText = vi.fn().mockResolvedValue(undefined)

    const wrapper = mountWorkspace(client, {
      props: { copyText }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('当前还没有可用的每日学习包。')
    expect(wrapper.text()).toContain('复制接续指令')
    await wrapper.find('[data-action="create-packet"]').trigger('click')
    await flushPromises()

    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('接续当前学习流程'))
  })
})
