import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MistakesBook from '../src/components/MistakesBook.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const createMistake = (attempts = []) => ({
  id: 'mistake:review-2026-07-23:exercise-1',
  status: 'active',
  created_at: '2026-07-23T09:00:00+08:00',
  source_daily: 'study/daily/2026-07-23.json',
  source_review: 'study/reviews/2026-07-23-review.json',
  daily_id: 'daily-2026-07-23',
  review_id: 'review-2026-07-23',
  exercise_id: 'exercise-1',
  lesson: 6,
  target_grammar: 'place で V',
  exercise_snapshot: {
    id: 'exercise-1',
    type: 'q_translate',
    lesson: 6,
    target_grammar: 'place で V',
    prompt: '请用日语表达：我在食堂吃午饭。',
    instruction: '请写一个完整句子。',
    context_note: '这是午休时向同事说明安排的场景。',
    answer_format: '完整日语句子',
    choices: [],
    supporting_lines: [],
    vocab_hints: ['食堂（しょくどう）'],
    answer_reference: 'しょくどうで ひるごはんを たべます。',
    metadata: {
      source: 'codex',
      difficulty: 'foundation',
      skill: 'output'
    }
  },
  review_snapshot: {
    exercise_id: 'exercise-1',
    is_correct: false,
    score: 0.4,
    error_tags: ['particle'],
    target_grammar: 'place で V',
    user_answer: 'しょくどうに ひるごはんを たべます。',
    correct_answer: 'しょくどうで ひるごはんを たべます。',
    explanation: '动作发生地点要使用助词「で」。',
    retry_recommended: true,
    rubric: null,
    confidence: 0.98,
    needs_user_input: false,
    acceptable_variants: [],
    vocabulary_feedback: [],
    manual_override: null
  },
  attempts,
  last_practiced_at: attempts.at(-1)?.submitted_at || null
})

const createClient = () => {
  const initial = createMistake()
  const submitted = createMistake([
    {
      id: initial.id + ':attempt:1',
      submitted_at: '2026-07-23T10:00:00+08:00',
      answer: 'しょくどうで ひるごはんを たべます。'
    }
  ])

  return {
    loadMistakes: vi.fn().mockResolvedValue({
      schema_version: 1,
      revision: 1,
      updated_at: '2026-07-23T09:00:00+08:00',
      items: [initial]
    }),
    submitMistakeAttempt: vi.fn().mockResolvedValue({
      mistakeBook: {
        schema_version: 1,
        revision: 2,
        updated_at: '2026-07-23T10:00:00+08:00',
        items: [submitted]
      },
      mistake: submitted
    })
  }
}

const stubs = {
  'el-card': {
    template: '<section><slot name="header" /><slot /></section>'
  },
  'el-alert': {
    props: ['title', 'description'],
    template: '<div>{{ title }} {{ description }}<slot name="title" /></div>'
  },
  'el-table': {
    template: '<div><slot /></div>'
  },
  'el-table-column': {
    template: '<div></div>'
  },
  'el-dialog': {
    props: ['modelValue'],
    template: '<div v-if="modelValue" class="dialog-stub"><slot /></div>'
  },
  'el-button': {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
  },
  'el-tag': {
    template: '<span><slot /></span>'
  },
  'el-input': {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea class="answer-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  'el-radio-group': {
    template: '<div><slot /></div>'
  },
  'el-radio-button': {
    template: '<button><slot /></button>'
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('MistakesBook', () => {
  it('converts romaji to kana when rewriting an agent-study mistake', async () => {
    const originalWanakana = window.wanakana
    window.wanakana = {
      toKana: vi.fn((value) => (value === 'shi' ? 'し' : value))
    }

    try {
      const wrapper = mount(MistakesBook, {
        props: { client: createClient() },
        global: { stubs }
      })
      await flushPromises()

      wrapper.vm.openReview(wrapper.vm.agentItems[0])
      await wrapper.vm.$nextTick()
      await wrapper.find('.answer-input').setValue('shi')

      expect(wrapper.find('.answer-input').element.value).toBe('し')
    } finally {
      if (originalWanakana) {
        window.wanakana = originalWanakana
      } else {
        delete window.wanakana
      }
    }
  })

  it('reveals stored review feedback only after submitting and can repeat the same item', async () => {
    const client = createClient()
    const wrapper = mount(MistakesBook, {
      props: { client },
      global: { stubs }
    })
    await flushPromises()

    expect(client.loadMistakes).toHaveBeenCalledTimes(1)
    const item = wrapper.vm.agentItems[0]
    wrapper.vm.openReview(item)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('请用日语表达：我在食堂吃午饭。')
    expect(wrapper.text()).not.toContain('动作发生地点要使用助词')
    expect(wrapper.text()).not.toContain('しょくどうで ひるごはんを たべます。')

    await wrapper.find('.answer-input').setValue('しょくどうで ひるごはんを たべます。')
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('提交并查看答案'))
    await submitButton.trigger('click')
    await flushPromises()

    expect(client.submitMistakeAttempt).toHaveBeenCalledWith({
      mistakeId: item.id,
      answer: 'しょくどうで ひるごはんを たべます。'
    })
    expect(wrapper.text()).toContain('しょくどうで ひるごはんを たべます。')
    expect(wrapper.text()).toContain('动作发生地点要使用助词')

    wrapper.vm.openReview(wrapper.vm.agentItems[0])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.answer-input').element.value).toBe('')
    expect(wrapper.text()).not.toContain('动作发生地点要使用助词')
  })
})
