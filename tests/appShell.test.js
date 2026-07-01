import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '../src/App.vue'

const hydrateFromDisk = vi.fn().mockResolvedValue()
const createBackupSnapshot = vi.fn()
const overwriteState = vi.fn()

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
  localStorage.clear()
})

describe('App shell', () => {
  it('shows only the three agent-study primary navigation entries', async () => {
    const wrapper = mountApp()
    await nextTick()

    expect(hydrateFromDisk).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Study Loop')
    expect(wrapper.text()).toContain('Agent Study')
    expect(wrapper.text()).toContain('Progress Review')
    expect(wrapper.text()).toContain('Review Drill')
    expect(wrapper.text()).not.toContain('Settings')
    expect(wrapper.text()).not.toContain('Weekly Review')
  })
})
