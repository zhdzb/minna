import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VocabularyBook from '../src/components/VocabularyBook.vue'

const loadVocabulary = vi.fn()

vi.mock('../src/utils/agentStudyClient', () => ({
  createAgentStudyClient: () => ({
    loadVocabulary
  })
}))

const vocabularyPayload = {
  summary: {
    total: 300,
    new: 298,
    learning: 1,
    review: 0,
    mastered: 1,
    due: 1,
    n5: 182,
    n4: 118
  },
  items: [
    {
      id: 'vocab-001',
      priority_rank: 1,
      word: 'する',
      kana: 'する',
      meaning: '做；进行',
      estimated_level: 'N5',
      category: '动作',
      status: 'mastered',
      seen_count: 3,
      correct_count: 3,
      is_due: false,
      due_date: '2026-08-13',
      modes: {
        production: { seen_count: 2, correct_count: 2 },
        reading: { seen_count: 1, correct_count: 1 },
        listening: { seen_count: 0, correct_count: 0 }
      }
    },
    {
      id: 'vocab-170',
      priority_rank: 170,
      word: '連絡',
      kana: 'れんらく',
      meaning: '联系；通知',
      estimated_level: 'N4',
      category: '工作',
      status: 'learning',
      seen_count: 1,
      correct_count: 0,
      is_due: true,
      due_date: '2026-07-23',
      modes: {
        production: { seen_count: 1, correct_count: 0 },
        reading: { seen_count: 0, correct_count: 0 },
        listening: { seen_count: 0, correct_count: 0 }
      }
    }
  ]
}

describe('VocabularyBook', () => {
  beforeEach(() => {
    loadVocabulary.mockReset()
    loadVocabulary.mockResolvedValue(vocabularyPayload)
  })

  it('renders catalog totals, words, and independent skill evidence', async () => {
    const wrapper = mount(VocabularyBook, {
      global: {
        stubs: {
          ElButton: { template: '<button><slot /></button>' },
          ElInput: { template: '<input />' },
          ElSegmented: { template: '<div />' },
          ElSelect: { template: '<div><slot /></div>' },
          ElOption: { template: '<span />' },
          ElAlert: { template: '<div />' },
          ElTag: { template: '<span><slot /></span>' },
          ElTable: { template: '<div><slot /></div>' },
          ElTableColumn: { template: '<div />' }
        },
        directives: {
          loading: {}
        }
      }
    })

    await vi.waitFor(() => expect(loadVocabulary).toHaveBeenCalled())
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('单词本')
    expect(wrapper.text()).toContain('300')
    expect(wrapper.vm.filteredItems).toHaveLength(2)
    expect(wrapper.vm.modeScore(vocabularyPayload.items[0], 'production')).toBe('2/2')
  })
})
