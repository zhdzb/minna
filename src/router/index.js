import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '@/components/Dashboard.vue'
import SyllabusManager from '@/components/SyllabusManager.vue'
import TrainingEngine from '@/components/TrainingEngine.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/syllabus',
    name: 'SyllabusManager',
    component: SyllabusManager
  },
  {
    path: '/training',
    name: 'TrainingEngine',
    component: TrainingEngine,
    // 因为涉及复杂的数据交换（难度、数量、特殊prompt等配置），所以我们使用 props: true
    props: true
  },
  {
    path: '/mistakes',
    name: 'MistakesBook',
    component: () => import('@/components/MistakesBook.vue')
  },
  {
    path: '/settings',
    name: 'SettingsCenter',
    component: () => import('@/components/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
