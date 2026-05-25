<template>
  <div>
    <el-alert
      v-if="tStore.exercises.length > 0 && tStore.currentPhase === 'answering'"
      type="warning"
      show-icon
      style="margin-bottom: 16px;"
    >
      <template #title>
        你有一个未完成的训练会话。
        <el-button size="small" type="primary" style="margin-left: 12px;" @click="resumeTraining">
          继续训练
        </el-button>
      </template>
    </el-alert>

    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">今日任务</div>
      </template>

      <div style="display: grid; gap: 12px;">
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div><strong>目标：</strong>{{ missionTitle }}</div>
          <div><strong>今日时长：</strong>{{ missionMinutes }} 分钟</div>
          <div><strong>必做：</strong>{{ requiredCount }} 项</div>
          <div><strong>选做：</strong>{{ optionalCount }} 项</div>
        </div>
        <el-progress :percentage="completionPercent" />
        <div v-if="store.daily_plan.ai_summary" style="color: #666;">{{ store.daily_plan.ai_summary }}</div>
      </div>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">生成今日计划</div>
      </template>

      <div style="display: grid; gap: 14px;">
        <div>
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">快速时长</div>
          <el-radio-group v-model="presetMinutes">
            <el-radio-button :label="30">30 分钟</el-radio-button>
            <el-radio-button :label="60">60 分钟</el-radio-button>
            <el-radio-button :label="90">90 分钟</el-radio-button>
            <el-radio-button :label="120">120 分钟</el-radio-button>
          </el-radio-group>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 13px; color: #666;">自定义时长</span>
          <el-input-number v-model="customMinutes" :min="15" :max="240" :step="5" />
          <span style="font-size: 13px; color: #666;">分钟</span>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <el-switch v-model="enableAiEnhancement" />
          <span style="font-size: 13px; color: #666;">生成后使用 AI 增强说明与练习提示</span>
        </div>

        <div style="display: flex; gap: 10px;">
          <el-button type="primary" :loading="isGeneratingPlan" @click="generatePlan">生成计划</el-button>
          <el-button plain @click="startTraining">去训练页</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <div style="font-weight: 700;">任务执行</div>
      </template>

      <el-empty v-if="planTasks.length === 0" description="先生成今天的计划，再开始执行任务。" />

      <div v-else style="display: grid; gap: 10px;">
        <div
          v-for="task in planTasks"
          :key="task.id"
          style="border: 1px solid #ebeef5; border-radius: 8px; padding: 12px;"
        >
          <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div>
              <div style="font-weight: 600;">{{ task.title }}</div>
              <div style="font-size: 12px; color: #888;">{{ task.minutes }} 分钟 · {{ task.required ? '必做' : '选做' }}</div>
            </div>
            <el-tag :type="statusTagType(task.status)">{{ statusLabel(task.status) }}</el-tag>
          </div>
          <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
            <el-button size="small" @click="setTaskStatus(task.id, 'in_progress')">开始</el-button>
            <el-button size="small" type="success" @click="setTaskStatus(task.id, 'completed')">完成</el-button>
            <el-button size="small" type="warning" @click="setTaskStatus(task.id, 'skipped')">跳过</el-button>
            <el-button
              v-if="task.type === 'pattern_drill'"
              size="small"
              type="primary"
              plain
              @click="launchPatternMode(task.id)"
            >
              进入句型替换
            </el-button>
            <el-button
              v-if="task.type === 'listening_drill'"
              size="small"
              type="primary"
              plain
              @click="launchListeningMode(task.id)"
            >
              进入听力关键词
            </el-button>
            <el-button
              v-if="task.type === 'shadowing'"
              size="small"
              type="primary"
              plain
              @click="launchShadowingMode(task.id)"
            >
              进入 Shadowing
            </el-button>
            <el-button
              v-if="task.type === 'scenario_speaking'"
              size="small"
              type="primary"
              plain
              @click="launchScenarioMode(task.id)"
            >
              进入场景口语
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMainStore } from '@/store/mainStore'
import { useTrainingStore } from '@/store/trainingStore'

const store = useMainStore()
const tStore = useTrainingStore()
const router = useRouter()

const presetMinutes = ref(60)
const customMinutes = ref(60)
const enableAiEnhancement = ref(true)
const isGeneratingPlan = ref(false)

const planTasks = computed(() => store.daily_plan?.tasks || [])
const requiredTasks = computed(() => planTasks.value.filter((item) => item.required))
const optionalTasks = computed(() => planTasks.value.filter((item) => !item.required))

const requiredCount = computed(() => requiredTasks.value.length)
const optionalCount = computed(() => optionalTasks.value.length)

const missionMinutes = computed(() => store.daily_plan?.available_minutes || 0)
const missionTitle = computed(() => {
  const type = store.daily_plan?.plan_type || ''
  if (!type) return '未生成计划'
  const labels = {
    foundation_review: '基础回炉',
    new_lesson: '新课推进',
    listening_speaking: '听说强化',
    mistake_review: '错题复盘',
    weekend_long_session: '周末长时段'
  }
  return labels[type] || type
})

const completionPercent = computed(() => {
  if (requiredTasks.value.length === 0) return 0
  const completed = requiredTasks.value.filter((item) => item.status === 'completed').length
  return Math.round((completed / requiredTasks.value.length) * 100)
})

const resolvedMinutes = computed(() => {
  const custom = Number(customMinutes.value)
  if (Number.isFinite(custom) && custom >= 15 && custom <= 240) {
    return custom
  }
  return Number(presetMinutes.value) || 60
})

const statusLabel = (status) => {
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '进行中'
  if (status === 'skipped') return '已跳过'
  return '待开始'
}

const statusTagType = (status) => {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'primary'
  if (status === 'skipped') return 'warning'
  return 'info'
}

const setTaskStatus = (taskId, status) => {
  const ok = store.setDailyTaskStatus(taskId, status)
  if (!ok) {
    ElMessage.error('任务状态更新失败。')
  }
}

const launchPatternMode = (taskId) => {
  setTaskStatus(taskId, 'in_progress')
  router.push('/training/pattern-substitution')
}

const launchListeningMode = (taskId) => {
  setTaskStatus(taskId, 'in_progress')
  router.push('/training/listening-keyword')
}

const launchShadowingMode = (taskId) => {
  setTaskStatus(taskId, 'in_progress')
  router.push('/training/shadowing')
}

const launchScenarioMode = (taskId) => {
  setTaskStatus(taskId, 'in_progress')
  router.push('/training/scenario-speaking')
}

const generatePlan = async () => {
  isGeneratingPlan.value = true
  try {
    const basePlan = store.createDailyPlanFromRules({
      availableMinutes: resolvedMinutes.value,
      currentLesson: store.progress.current_lesson,
      prioritizeListeningSpeaking: true
    })

    if (!enableAiEnhancement.value) {
      ElMessage.success('已生成规则计划。')
      return
    }

    try {
      const response = await fetch('/api/ai/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: basePlan,
          context: {
            current_stage: 'study_execution',
            target_exam: 'N3',
            priority_skills: ['listening', 'speaking'],
            current_lesson: store.progress.current_lesson,
            active_review_lessons: basePlan.focus_lessons || [],
            recent_weak_patterns: Object.keys(store.pattern_mastery || {}).slice(0, 6),
            last_7_days_summary: {
              planned_minutes: resolvedMinutes.value * 5,
              completed_minutes: 0,
              missed_tasks: 0
            },
            provider: 'server',
            prompt_version: 'daily-plan-v1'
          }
        })
      })

      if (!response.ok) {
        throw new Error(`AI route failed: ${response.status}`)
      }

      const payload = await response.json()
      const aiData = payload?.data
      if (aiData?.summary) {
        store.daily_plan.ai_summary = aiData.summary
        store.saveState()
      }
      ElMessage.success('已生成并增强今日计划。')
    } catch (_error) {
      ElMessage.warning('AI 增强失败，已保留规则计划。')
    }
  } finally {
    isGeneratingPlan.value = false
  }
}

const startTraining = () => {
  router.push({
    path: '/training',
    query: {
      sessionConfig: JSON.stringify({
        targetLesson: store.progress.current_lesson,
        questionCount: 5,
        difficulty: '基础巩固',
        customPrompt: '',
        questionType: 'ALL'
      }),
      t: Date.now()
    }
  })
}

const resumeTraining = () => {
  router.push({
    path: '/training',
    query: {
      sessionConfig: JSON.stringify(tStore.currentConfig),
      t: tStore.sessionTimestamp
    }
  })
}
</script>
