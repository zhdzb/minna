import { createRouter, createWebHashHistory } from 'vue-router'
import AgentStudyWorkspace from '@/components/AgentStudyWorkspace.vue'
import AgentProgressReview from '@/components/AgentProgressReview.vue'
import AgentReviewDrill from '@/components/AgentReviewDrill.vue'
import SyllabusManager from '@/components/SyllabusManager.vue'
import WeeklyReview from '@/components/WeeklyReview.vue'

const routes = [
  {
    path: '/',
    redirect: '/agent-study'
  },
  {
    path: '/agent-study',
    name: 'AgentStudyWorkspace',
    component: AgentStudyWorkspace
  },
  {
    path: '/agent-progress-review',
    name: 'AgentProgressReview',
    component: AgentProgressReview
  },
  {
    path: '/agent-review-drill',
    name: 'AgentReviewDrill',
    component: AgentReviewDrill
  },
  {
    path: '/syllabus',
    name: 'SyllabusManager',
    component: SyllabusManager
  },
  {
    path: '/mistakes',
    name: 'MistakesBook',
    component: () => import('@/components/MistakesBook.vue')
  },
  {
    path: '/vocabulary',
    name: 'VocabularyBook',
    component: () => import('@/components/VocabularyBook.vue')
  },
  {
    path: '/weekly-review',
    name: 'WeeklyReview',
    component: WeeklyReview
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/agent-study'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
