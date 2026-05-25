<template>
  <div style="padding: 24px;">
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <h2 style="margin: 0;">每周复盘</h2>
            <p style="margin: 6px 0 0; color: #666;">查看本周进展、薄弱点和下周重点。</p>
          </div>
          <el-button type="primary" :loading="loading" @click="generateSummary">生成 AI 周总结</el-button>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="计划分钟">{{ payload.weekly_stats.planned_minutes }}</el-descriptions-item>
        <el-descriptions-item label="完成分钟">{{ payload.weekly_stats.completed_minutes }}</el-descriptions-item>
        <el-descriptions-item label="跳过任务">{{ payload.weekly_stats.missed_tasks }}</el-descriptions-item>
        <el-descriptions-item label="学习天数">{{ payload.weekly_stats.completed_days }}/{{ payload.weekly_stats.total_days }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="errorMessage"
        type="warning"
        :closable="false"
        style="margin-top: 16px;"
        :title="errorMessage"
      />

      <el-empty
        v-if="!summary && !loading"
        description="还没有 AI 周总结，点击右上角按钮生成。"
        style="margin-top: 12px;"
      />

      <div v-else-if="summary" style="margin-top: 16px;">
        <el-card shadow="never" style="margin-bottom: 12px; background: #fafafa;">
          <template #header>本周总览</template>
          <p style="margin: 0;">{{ summary.overview }}</p>
        </el-card>

        <el-row :gutter="12">
          <el-col :xs="24" :md="12">
            <el-card shadow="never" style="margin-bottom: 12px;">
              <template #header>本周亮点</template>
              <ul style="margin: 0; padding-left: 18px;">
                <li v-for="item in summary.achievements" :key="`a-${item}`">{{ item }}</li>
              </ul>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="never" style="margin-bottom: 12px;">
              <template #header>风险与薄弱点</template>
              <ul style="margin: 0; padding-left: 18px;">
                <li v-for="item in summary.risks" :key="`r-${item}`">{{ item }}</li>
              </ul>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :xs="24" :md="12">
            <el-card shadow="never" style="margin-bottom: 12px;">
              <template #header>下周重点</template>
              <ul style="margin: 0; padding-left: 18px;">
                <li v-for="item in summary.next_week_focus" :key="`n-${item}`">{{ item }}</li>
              </ul>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="never" style="margin-bottom: 12px;">
              <template #header>口语任务</template>
              <ul style="margin: 0; padding-left: 18px;">
                <li v-for="item in summary.speaking_tasks" :key="`s-${item}`">{{ item }}</li>
              </ul>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never">
          <template #header>听力任务</template>
          <ul style="margin: 0; padding-left: 18px;">
            <li v-for="item in summary.listening_tasks" :key="`l-${item}`">{{ item }}</li>
          </ul>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useMainStore } from '@/store/mainStore'

const store = useMainStore()
const loading = ref(false)
const summary = ref(null)
const errorMessage = ref('')

const payload = computed(() =>
  store.buildWeeklyReviewPayload({
    target_exam: 'N3',
    priority_skills: ['listening', 'speaking']
  })
)

const generateSummary = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch('/api/ai/weekly-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload.value)
    })
    const result = await response.json()

    if (!response.ok || !result?.success || !result?.data) {
      throw new Error(result?.error || 'AI 周总结生成失败')
    }

    summary.value = result.data
    ElMessage.success('已生成本周总结')
  } catch (error) {
    summary.value = null
    errorMessage.value = `周数据已聚合，但 AI 总结生成失败：${error.message}`
    ElMessage.warning('AI 周总结失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>
