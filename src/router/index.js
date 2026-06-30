import { createRouter, createWebHashHistory } from 'vue-router'
import AgentStudyWorkspace from '@/components/AgentStudyWorkspace.vue'
import Dashboard from '@/components/Dashboard.vue'
import SyllabusManager from '@/components/SyllabusManager.vue'
import TrainingEngine from '@/components/TrainingEngine.vue'
import PatternSubstitutionMode from '@/components/PatternSubstitutionMode.vue'
import ListeningKeywordMode from '@/components/ListeningKeywordMode.vue'
import ShadowingMode from '@/components/ShadowingMode.vue'
import ScenarioSpeakingMode from '@/components/ScenarioSpeakingMode.vue'
import WeeklyReview from '@/components/WeeklyReview.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/agent-study',
    name: 'AgentStudyWorkspace',
    component: AgentStudyWorkspace
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
  },
  {
    path: '/weekly-review',
    name: 'WeeklyReview',
    component: WeeklyReview
  },
  {
    path: '/training/pattern-substitution',
    name: 'PatternSubstitutionMode',
    component: PatternSubstitutionMode
  },
  {
    path: '/training/listening-keyword',
    name: 'ListeningKeywordMode',
    component: ListeningKeywordMode
  },
  {
    path: '/training/shadowing',
    name: 'ShadowingMode',
    component: ShadowingMode
  },
  {
    path: '/training/scenario-speaking',
    name: 'ScenarioSpeakingMode',
    component: ScenarioSpeakingMode
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
