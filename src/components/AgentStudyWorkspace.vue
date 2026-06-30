<template>
  <div class="agent-study-page">
    <header class="agent-study-header">
      <div>
        <p class="agent-study-eyebrow">Codex Study Loop</p>
        <h1>Agent Study Workspace</h1>
        <p class="agent-study-subtitle">今天的学习包、材料和练习都会在这里展开。</p>
      </div>
      <el-button :loading="isLoading" type="primary" @click="loadWorkspace">刷新</el-button>
    </header>

    <section v-if="isLoading" class="agent-study-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="agent-study-band">
      <el-alert :closable="false" show-icon title="加载失败" type="error" :description="loadError" />
    </section>

    <section v-else-if="!dailyPacket" class="agent-study-band">
      <el-empty description="当前还没有可用的学习包。" />
    </section>

    <template v-else>
      <section class="agent-study-band agent-study-overview">
        <div class="overview-copy">
          <p class="agent-study-eyebrow">今日任务</p>
          <h2>{{ missionTitle }}</h2>
          <p>{{ missionSummary }}</p>
        </div>
        <div class="overview-meta">
          <div class="meta-item">
            <span>日期</span>
            <strong>{{ dailyPacket.date || '--' }}</strong>
          </div>
          <div class="meta-item">
            <span>状态</span>
            <el-tag :type="statusTagType" effect="plain">{{ dailyPacket.status || 'unknown' }}</el-tag>
          </div>
          <div class="meta-item">
            <span>计划时长</span>
            <strong>{{ availableMinutesLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>聚焦课次</span>
            <strong>{{ focusLessonsLabel }}</strong>
          </div>
        </div>
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>任务清单</h2>
          <span>{{ taskCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.tasks?.length" class="item-grid">
          <article v-for="task in dailyPacket.tasks" :key="task.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ task.title || task.id }}</h3>
              <el-tag size="small" effect="plain">{{ task.status || 'pending' }}</el-tag>
            </div>
            <p class="item-type">{{ task.type || 'task' }}</p>
            <p class="item-note">{{ task.minutes ? `${task.minutes} 分钟` : '时长待定' }}</p>
          </article>
        </div>
        <el-empty v-else description="今天还没有任务项。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>学习材料</h2>
          <span>{{ materialCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.study_materials?.length" class="item-grid">
          <article v-for="material in dailyPacket.study_materials" :key="material.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ material.title || material.id }}</h3>
              <el-tag size="small" effect="plain">{{ material.type || 'material' }}</el-tag>
            </div>
            <p class="item-type">Lesson {{ material.lesson ?? '--' }}</p>
            <p class="item-copy">{{ material.content || '暂无材料说明。' }}</p>
            <ul v-if="material.examples?.length" class="example-list">
              <li v-for="(example, index) in material.examples" :key="`${material.id}-${index}`">
                <strong>{{ example.ja || '例句' }}</strong>
                <span>{{ example.zh || example.note || '' }}</span>
              </li>
            </ul>
          </article>
        </div>
        <el-empty v-else description="今天还没有学习材料。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>练习列表</h2>
          <span>{{ exerciseCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.exercises?.length" class="item-grid">
          <article v-for="exercise in dailyPacket.exercises" :key="exercise.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ exercise.prompt || exercise.id }}</h3>
              <el-tag size="small" type="success" effect="plain">{{ exercise.type || 'exercise' }}</el-tag>
            </div>
            <p class="item-type">{{ exercise.target_grammar || '未标注语法点' }}</p>
            <p class="item-note">Lesson {{ exercise.lesson ?? '--' }} · {{ exercise.metadata?.skill || 'skill 未标注' }}</p>
            <p v-if="exercise.vocab_hints?.length" class="item-copy">
              提示：{{ exercise.vocab_hints.join(' / ') }}
            </p>
          </article>
        </div>
        <el-empty v-else description="今天还没有练习题。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>复习线索</h2>
          <span>{{ reviewItemCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.review_items?.length || indexDocument?.latest_review || reviewResult" class="review-summary">
          <div class="meta-item">
            <span>待复习项目</span>
            <strong>{{ reviewItemCountLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>最新 review</span>
            <strong>{{ indexDocument?.latest_review || '暂无' }}</strong>
          </div>
          <div class="meta-item">
            <span>当前 correction 状态</span>
            <strong>{{ dailyPacket.correction?.status || 'pending' }}</strong>
          </div>
        </div>
        <el-empty v-else description="当前没有复习结果或复习线索。" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { createAgentStudyClient } from '@/utils/agentStudyClient'

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const isLoading = ref(true)
const loadError = ref('')
const indexDocument = ref(null)
const dailyPacket = ref(null)
const reviewResult = ref(null)

const client = computed(() => props.client || createAgentStudyClient())

const missionTitle = computed(() => dailyPacket.value?.mission?.title || '未命名学习包')
const missionSummary = computed(() => {
  const mission = dailyPacket.value?.mission
  if (!mission) return '还没有可展示的学习任务。'

  const goals = Array.isArray(mission.goals) ? mission.goals.filter(Boolean) : []
  return goals.length ? goals.join(' · ') : '今天先把基础计划和材料整理出来。'
})

const availableMinutesLabel = computed(() => {
  const minutes = dailyPacket.value?.mission?.available_minutes
  return typeof minutes === 'number' ? `${minutes} 分钟` : '--'
})

const focusLessonsLabel = computed(() => {
  const lessons = dailyPacket.value?.mission?.focus_lessons
  return Array.isArray(lessons) && lessons.length ? lessons.join(', ') : '--'
})

const statusTagType = computed(() => {
  const status = dailyPacket.value?.status
  if (status === 'submitted' || status === 'reviewed') return 'success'
  if (status === 'answering' || status === 'learning') return 'warning'
  return 'info'
})

const taskCountLabel = computed(() => `${dailyPacket.value?.tasks?.length || 0} 项`)
const materialCountLabel = computed(() => `${dailyPacket.value?.study_materials?.length || 0} 份`)
const exerciseCountLabel = computed(() => `${dailyPacket.value?.exercises?.length || 0} 题`)
const reviewItemCountLabel = computed(() => `${dailyPacket.value?.review_items?.length || 0} 条`)

const loadWorkspace = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const payload = await client.value.loadLatestAgentStudy()
    indexDocument.value = payload?.index || null
    dailyPacket.value = payload?.dailyPacket || null
    reviewResult.value = payload?.reviewResult || null
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadWorkspace()
})
</script>

<style scoped>
.agent-study-page {
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f5f7fb;
  color: #1f2937;
}

.agent-study-header,
.agent-study-overview,
.review-summary,
.item-grid {
  display: grid;
  gap: 16px;
}

.agent-study-header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}

.agent-study-header h1,
.section-heading h2,
.overview-copy h2,
.item-card h3 {
  margin: 0;
}

.agent-study-subtitle,
.item-copy,
.item-note,
.item-type,
.agent-study-eyebrow {
  margin: 0;
}

.agent-study-eyebrow {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
}

.agent-study-subtitle {
  margin-top: 6px;
  color: #475569;
}

.agent-study-band {
  padding: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #dbe3f1;
  border-radius: 8px;
}

.agent-study-overview {
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  align-items: start;
}

.overview-copy h2 {
  margin-top: 8px;
  font-size: 28px;
}

.overview-copy p:last-child {
  margin-top: 10px;
  color: #475569;
  line-height: 1.6;
}

.overview-meta,
.review-summary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.meta-item span {
  font-size: 12px;
  color: #64748b;
}

.meta-item strong {
  font-size: 15px;
  color: #0f172a;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading span {
  color: #64748b;
  font-size: 13px;
}

.item-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.item-card {
  min-width: 0;
  padding: 16px;
  background: #fbfdff;
  border: 1px solid #dbe3f1;
  border-radius: 8px;
}

.item-card-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.item-card h3 {
  font-size: 16px;
  line-height: 1.5;
}

.item-type {
  margin-top: 10px;
  color: #4f46e5;
  font-size: 13px;
}

.item-note {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.item-copy {
  margin-top: 10px;
  color: #334155;
  line-height: 1.6;
}

.example-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #475569;
  display: grid;
  gap: 8px;
}

.example-list strong,
.example-list span {
  display: block;
}

@media (max-width: 900px) {
  .agent-study-header,
  .agent-study-overview,
  .overview-meta,
  .review-summary {
    grid-template-columns: 1fr;
  }
}
</style>
