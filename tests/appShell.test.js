import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '../src/App.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const hydrateFromDisk = vi.fn().mockResolvedValue()
const createBackupSnapshot = vi.fn()
const overwriteState = vi.fn()
const loadProgressReview = vi.fn().mockResolvedValue({
  current: { current_lesson: 9 },
  phase: 'studying'
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: {
      value: {
        path: '/agent-study'
      }
    }
  })
}))

vi.mock('@/store/mainStore', () => ({
  useMainStore: () => ({
    progress: {
      current_lesson: 7
    },
    meta: {
      last_persistence_error: ''
    },
    $state: {},
    hydrateFromDisk,
    createBackupSnapshot,
    overwriteState
  }),
  buildPersistableState: vi.fn().mockReturnValue({})
}))

vi.mock('@/utils/backupPayload', () => ({
  validateBackupPayloadShape: vi.fn((value) => value)
}))

vi.mock('@/utils/agentStudyClient', () => ({
  createAgentStudyClient: () => ({ loadProgressReview })
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn()
  }
}))

const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        'el-config-provider': {
          template: '<div><slot /></div>'
        },
        'el-container': {
          template: '<div><slot /></div>'
        },
        'el-aside': {
          template: '<aside><slot /></aside>'
        },
        'el-main': {
          template: '<main><slot /></main>'
        },
        'el-menu': {
          template: '<nav><slot /></nav>'
        },
        'el-menu-item': {
          props: ['index'],
          template: '<a :data-index="index"><slot /></a>'
        },
        'el-button': {
          template: '<button><slot /></button>'
        },
        'el-switch': {
          template: '<div class="switch-stub"></div>'
        },
        'router-view': {
          template: '<div class="router-view-stub"></div>'
        }
      }
    }
  })

afterEach(() => {
  hydrateFromDisk.mockClear()
  createBackupSnapshot.mockClear()
  overwriteState.mockClear()
  loadProgressReview.mockClear()
  localStorage.clear()
})

describe('App shell', () => {
  it('shows the main agent-study navigation entries and syllabus management', async () => {
    const wrapper = mountApp()
    await nextTick()
    await flushPromises()

    expect(hydrateFromDisk).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Study Loop')
    expect(wrapper.text()).toContain('学习工作台')
    expect(wrapper.text()).toContain('进度总览')
    expect(wrapper.text()).toContain('复习训练')
    expect(wrapper.text()).toContain('错题训练')
    expect(wrapper.text()).toContain('单词本')
    expect(wrapper.text()).toContain('听读跟读')
    expect(wrapper.text()).toContain('课纲管理')
    expect(loadProgressReview).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('当前课程：第 9 课')
    expect(wrapper.text()).toContain('学习与作答')
    expect(wrapper.text()).not.toContain('Settings')
    expect(wrapper.text()).not.toContain('Weekly Review')
  })
})
