<template>
  <div class="progress-page">
    <header class="progress-header">
      <div>
        <p class="progress-eyebrow">Codex Study Loop</p>
        <h1>进度总览</h1>
        <p class="progress-subtitle">集中查看学习者状态、复习压力和下一次交接给 Codex 的上下文。</p>
      </div>
      <el-button :loading="isLoading" @click="loadProgress">刷新</el-button>
    </header>

    <section v-if="isLoading" class="progress-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="progress-band">
      <el-alert :closable="false" show-icon title="加载失败" type="error" :description="loadError" />
    </section>

    <template v-else-if="progressPayload">
      <section class="progress-band summary-grid">
        <article class="summary-card">
          <span>当前课程</span>
          <strong>{{ progressPayload.current?.current_lesson ?? '--' }}</strong>
          <p>{{ progressPayload.current?.learning_mode || '暂无学习模式' }}</p>
        </article>
        <article class="summary-card">
          <span>每日预算</span>
          <strong>{{ dailyBudgetLabel }}</strong>
          <p>{{ progressPayload.profile?.pace_preference || '暂无节奏偏好' }}</p>
        </article>
        <article class="summary-card">
          <span>到期复习</span>
          <strong>{{ dueQueueCount }}</strong>
          <p>后面还有 {{ scheduledQueueCount }} 项待排程</p>
        </article>
        <article class="summary-card">
          <span>推进状态</span>
          <strong>{{ promotionLabel }}</strong>
          <p>{{ promotionReasonPreview }}</p>
        </article>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>学习者画像</h2>
          <span>{{ progressPayload.profile?.learner_id || '--' }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>学习目标</h3>
            <ul v-if="profileGoals.length" class="detail-list">
              <li v-for="goal in profileGoals" :key="goal">{{ goal }}</li>
            </ul>
            <p v-else class="detail-note">暂未记录明确目标。</p>
          </article>
          <article class="detail-card">
            <h3>学习偏好</h3>
            <dl class="meta-list">
              <div>
                <dt>教材系列</dt>
                <dd>{{ progressPayload.profile?.material_scope?.series || '--' }}</dd>
              </div>
              <div>
                <dt>允许新课</dt>
                <dd>{{ boolLabel(progressPayload.profile?.material_scope?.allow_new_lessons) }}</dd>
              </div>
              <div>
                <dt>允许罗马音</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.allow_romaji) }}</dd>
              </div>
              <div>
                <dt>优先假名</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.prefer_kana_first) }}</dd>
              </div>
              <div>
                <dt>练习汉字</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.practice_kanji) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>掌握度快照</h2>
          <span>{{ progressPayload.mastery?.current_gate || '--' }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>课程状态</h3>
            <div class="lesson-state-list">
              <div v-for="lessonState in lessonStates" :key="lessonState.key" class="lesson-state-item">
                <div class="item-head">
                  <strong>第 {{ lessonState.lesson }} 课</strong>
                  <el-tag size="small" effect="plain">{{ lessonState.status }}</el-tag>
                </div>
                <div class="score-row">
                  <span v-for="(value, skill) in lessonState.skill_scores" :key="`${lessonState.key}-${skill}`">
                    {{ skill }} {{ formatPercent(value) }}
                  </span>
                </div>
              </div>
            </div>
          </article>
          <article class="detail-card">
            <h3>薄弱语法</h3>
            <div v-if="weakGrammarPoints.length" class="grammar-list">
              <div v-for="point in weakGrammarPoints" :key="point.key" class="grammar-item">
                <div class="item-head">
                  <strong>{{ point.pattern }}</strong>
                  <el-tag size="small" effect="plain">{{ point.status }}</el-tag>
                </div>
                <p class="detail-note">
                  第 {{ point.lesson }} 课 · 受控输出 {{ formatPercent(point.controlled_output) }} · 自由输出
                  {{ formatPercent(point.free_output) }}
                </p>
              </div>
            </div>
            <p v-else class="detail-note">当前没有记录薄弱语法点。</p>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>复习队列</h2>
          <span>{{ queueItems.length }} 项</span>
        </div>
        <div v-if="queueItems.length" class="queue-list">
          <article v-for="item in queueItems" :key="item.id" class="queue-item">
            <div class="item-head">
              <strong>{{ item.key }}</strong>
              <el-tag size="small" :type="item.status === 'due' ? 'danger' : 'info'" effect="plain">
                {{ item.status }}
              </el-tag>
            </div>
            <p class="detail-note">到期 {{ item.due_date }} · 结果 {{ item.last_result }} · 间隔 {{ item.interval_days }} 天 · ease {{ item.ease }}</p>
          </article>
        </div>
        <el-empty v-else description="当前没有复习队列项目。" />
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>推进决策</h2>
          <span>{{ latestReviewId }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>最近批改</h3>
            <p class="detail-copy">{{ progressPayload.reviewResult?.overall?.summary || '暂时还没有批改总结。' }}</p>
            <p class="detail-note">正确率 {{ formatPercent(progressPayload.reviewResult?.overall?.accuracy) }}</p>
          </article>
          <article class="detail-card">
            <h3>当前门槛</h3>
            <p class="detail-copy">
              {{ progressPayload.reviewResult?.promotion_decision?.reason || '暂时还没有推进判断。' }}
            </p>
            <ul v-if="nextFocus.length" class="detail-list">
              <li v-for="focus in nextFocus" :key="focus">{{ focus }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>最近事件</h2>
          <span>{{ recentEvents.length }} 条</span>
        </div>
        <div v-if="recentEvents.length" class="event-list">
          <article v-for="event in recentEvents" :key="event.event_id" class="event-item">
            <div class="item-head">
              <strong>{{ event.event }}</strong>
              <span class="event-meta">{{ event.actor }} · {{ event.time }}</span>
            </div>
            <p class="detail-copy">{{ event.summary }}</p>
          </article>
        </div>
        <el-empty v-else description="当前没有事件日志记录。" />
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>下一次 Agent 上下文</h2>
          <span>{{ progressPayload.nextAgentContext?.path || '--' }}</span>
        </div>
        <pre class="context-preview">{{ progressPayload.nextAgentContext?.content || '当前没有 next-agent-context 内容。' }}</pre>
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
const progressPayload = ref(null)

const client = computed(() => props.client || createAgentStudyClient())

const queueItems = computed(() => progressPayload.value?.reviewQueue?.items || [])
const dueQueueCount = computed(() => queueItems.value.filter((item) => item.status === 'due').length)
const scheduledQueueCount = computed(() => queueItems.value.filter((item) => item.status !== 'due').length)
const profileGoals = computed(() => progressPayload.value?.profile?.goals || [])
const nextFocus = computed(() => progressPayload.value?.reviewResult?.overall?.next_focus || [])
const recentEvents = computed(() => progressPayload.value?.recentEvents || [])
const lessonStates = computed(() =>
  Object.entries(progressPayload.value?.mastery?.lesson_states || {}).map(([key, value]) => ({
    key,
    ...value
  }))
)
const weakGrammarPoints = computed(() =>
  Object.entries(progressPayload.value?.mastery?.grammar_points || {})
    .map(([key, value]) => ({ key, ...value }))
    .filter((point) => point.status === 'weak' || point.status === 'learning' || point.status === 'decayed')
    .sort((left, right) => left.controlled_output - right.controlled_output)
    .slice(0, 6)
)
const latestReviewId = computed(() => progressPayload.value?.reviewResult?.id || '暂无批改')
const promotionLabel = computed(() =>
  progressPayload.value?.reviewResult?.promotion_decision?.can_advance ? '可推进' : '暂缓'
)
const promotionReasonPreview = computed(() => {
  const reason = progressPayload.value?.reviewResult?.promotion_decision?.reason || '暂时还没有推进信号。'
  return reason.length > 72 ? `${reason.slice(0, 72)}...` : reason
})
const dailyBudgetLabel = computed(() => {
  const value = progressPayload.value?.profile?.daily_time_budget_minutes
  return typeof value === 'number' ? `${value} 分钟` : '--'
})

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value * 100)}%`
}

const boolLabel = (value) => (value ? '是' : '否')

const loadProgress = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    progressPayload.value = await client.value.loadProgressReview()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadProgress()
})
</script>

<style scoped>
.progress-page {
  min-height: 100%;
  padding: 24px;
  display: grid;
  gap: 16px;
  background: transparent;
  color: var(--app-text);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
}

.progress-header h1,
.section-heading h2,
.detail-card h3,
.summary-card strong {
  margin: 0;
}

.progress-eyebrow,
.progress-subtitle,
.detail-note,
.detail-copy {
  margin: 0;
}

.progress-eyebrow {
  font-size: 12px;
  color: var(--app-text-soft);
}

.progress-subtitle {
  margin-top: 6px;
  color: var(--app-text-muted);
}

.progress-band {
  padding: 20px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.summary-grid,
.detail-grid {
  display: grid;
  gap: 16px;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-card,
.detail-card,
.queue-item,
.event-item {
  min-width: 0;
  padding: 16px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.summary-card span,
.meta-list dt,
.event-meta {
  font-size: 12px;
  color: var(--app-text-soft);
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  color: var(--app-text-strong);
}

.summary-card p,
.detail-note {
  margin-top: 8px;
  color: var(--app-text-muted);
  line-height: 1.5;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading span {
  color: var(--app-text-soft);
  font-size: 13px;
}

.two-up {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-card {
  display: grid;
  gap: 12px;
}

.detail-copy {
  color: var(--app-text-muted);
  line-height: 1.6;
}

.detail-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  display: grid;
  gap: 8px;
}

.meta-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.meta-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.meta-list dd {
  margin: 0;
  color: var(--app-text-strong);
}

.lesson-state-list,
.grammar-list,
.queue-list,
.event-list {
  display: grid;
  gap: 12px;
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
}

.score-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--app-text-muted);
  font-size: 13px;
}

.context-preview {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-soft-bg);
  color: var(--app-text);
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .summary-grid,
  .two-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .progress-header,
  .summary-grid,
  .two-up {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
