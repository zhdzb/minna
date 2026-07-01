<template>
  <div class="drill-page">
    <header class="drill-header">
      <div>
        <p class="drill-eyebrow">Codex Study Loop</p>
        <h1>复习训练</h1>
        <p class="drill-subtitle">在这里完成结构化复习变体题，需要时先保存草稿，确认后再提交回仓库。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="isSaving" @click="saveDrill">保存草稿</el-button>
        <el-button type="primary" :loading="isSubmitting" @click="submitDrill">提交训练</el-button>
        <el-button :loading="isLoading" @click="loadDrill">刷新</el-button>
      </div>
    </header>

    <section v-if="isLoading" class="drill-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="drill-band">
      <el-alert :closable="false" show-icon title="加载失败" type="error" :description="loadError" />
    </section>

    <template v-else-if="reviewDrill">
      <section class="drill-band summary-grid">
        <article class="summary-card">
          <span>训练状态</span>
          <strong>{{ reviewDrill.status }}</strong>
          <p>{{ reviewDrill.summary.title }}</p>
        </article>
        <article class="summary-card">
          <span>聚焦项目</span>
          <strong>{{ reviewDrill.items.length }}</strong>
          <p>{{ reviewDrill.summary.focus.join(' / ') || '暂无重点标签' }}</p>
        </article>
        <article class="summary-card">
          <span>最近批改</span>
          <strong>{{ latestReviewId }}</strong>
          <p>{{ latestReviewAccuracy }}</p>
        </article>
      </section>

      <section v-if="actionMessage" class="drill-band action-band">
        <el-alert :closable="false" show-icon title="复习训练已更新" type="success" :description="actionMessage" />
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>结构化训练包</h2>
          <span>{{ reviewDrill.items.length }} 题</span>
        </div>
        <div class="drill-list">
          <article v-for="item in reviewDrill.items" :key="item.id" class="drill-card">
            <div class="item-head">
              <div>
                <h3>{{ formatQueueKey(item.key) }}</h3>
                <p class="item-subtitle">第 {{ item.lesson }} 课 · {{ item.target_grammar }} · {{ item.status }}</p>
              </div>
              <el-tag size="small" :type="item.status === 'submitted' ? 'success' : 'warning'" effect="plain">
                {{ item.review_queue_id }}
              </el-tag>
            </div>

            <div class="detail-block">
              <p class="block-label">薄弱点说明</p>
              <p class="detail-copy">{{ item.weakness_explanation }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">最近错误标签</p>
              <div class="chip-row">
                <span v-for="tag in item.error_tags" :key="tag" class="chip chip-warning">{{ tag }}</span>
              </div>
            </div>

            <div class="detail-block">
              <p class="block-label">原题</p>
              <p class="detail-copy">{{ item.original_prompt }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">变体训练题</p>
              <p class="detail-copy detail-copy-strong">{{ item.variant_prompt }}</p>
            </div>

            <div v-if="item.hint" class="detail-block">
              <p class="block-label">提示</p>
              <p class="detail-copy">{{ item.hint }}</p>
            </div>

            <label class="answer-field">
              <span>你的复习答案</span>
              <textarea
                class="draft-input"
                :value="item.user_answer"
                rows="4"
                placeholder="请为这道复习变体题重新作答。"
                @input="updateAnswer(item.id, $event.target.value)"
              />
            </label>

            <div class="detail-block answer-reference-block">
              <p class="block-label">参考答案</p>
              <p class="detail-copy">{{ item.answer_reference }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>到期队列快照</h2>
          <span>{{ dueItems.length }} 项到期</span>
        </div>
        <div v-if="dueItems.length" class="chip-row">
          <span v-for="item in dueItems" :key="item.id" class="chip">
            {{ formatQueueKey(item.key) }} · {{ item.last_result }} · 到期 {{ item.due_date }}
          </span>
        </div>
        <el-empty v-else description="当前没有待处理的到期复习项目。" />
      </section>
    </template>

    <section v-else class="drill-band">
      <el-empty description="当前还没有可用的复习训练包。" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { createAgentStudyClient } from '@/utils/agentStudyClient'
import { toKanaInput } from '@/utils/wanakanaInput'

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const isLoading = ref(true)
const isSaving = ref(false)
const isSubmitting = ref(false)
const loadError = ref('')
const actionMessage = ref('')
const progressPayload = ref(null)
const reviewDrill = ref(null)
const reviewDrillPath = ref('')

const client = computed(() => props.client || createAgentStudyClient())

const latestReviewId = computed(() => progressPayload.value?.reviewResult?.id || '暂无批改')
const latestReviewAccuracy = computed(() => {
  const value = progressPayload.value?.reviewResult?.overall?.accuracy
  if (typeof value !== 'number' || Number.isNaN(value)) return '暂无批改正确率'
  return `正确率 ${Math.round(value * 100)}%`
})
const dueItems = computed(() => (progressPayload.value?.reviewQueue?.items || []).filter((item) => item.status === 'due'))

const cloneValue = (value) => JSON.parse(JSON.stringify(value))

const hydrateReviewDrill = (payload) => {
  if (!payload) {
    reviewDrill.value = null
    return
  }

  reviewDrill.value = {
    ...payload,
    items: (payload.items || []).map((item) => ({
      ...item,
      user_answer: item.user_answer || ''
    }))
  }
}

const loadDrill = async () => {
  isLoading.value = true
  loadError.value = ''
  actionMessage.value = ''

  try {
    const [nextProgressPayload, latestReviewDrill] = await Promise.all([
      client.value.loadProgressReview(),
      client.value.loadLatestReviewDrill()
    ])
    progressPayload.value = nextProgressPayload
    hydrateReviewDrill(latestReviewDrill)
    reviewDrillPath.value = latestReviewDrill?.date ? `study/review-drills/${latestReviewDrill.date}.json` : ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const formatQueueKey = (value) => String(value || '').replaceAll('/', ' / ')

const updateAnswer = (itemId, value) => {
  if (!reviewDrill.value) return

  reviewDrill.value = {
    ...reviewDrill.value,
    items: reviewDrill.value.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            user_answer: toKanaInput(value)
          }
        : item
    )
  }
}

const persistDrill = async (mode) => {
  if (!reviewDrill.value) return

  const requestPayload = {
    reviewDrill: cloneValue(reviewDrill.value),
    targetPath: reviewDrillPath.value
  }

  if (mode === 'save') {
    isSaving.value = true
  } else {
    isSubmitting.value = true
  }
  loadError.value = ''
  actionMessage.value = ''

  try {
    const result =
      mode === 'save'
        ? await client.value.saveReviewDrill(requestPayload)
        : await client.value.submitReviewDrill(requestPayload)

    hydrateReviewDrill(result.reviewDrill)
    reviewDrillPath.value = result.targetPath || reviewDrillPath.value
    actionMessage.value = mode === 'save' ? '复习训练草稿已保存。' : '复习训练答案已成功提交。'
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
    isSubmitting.value = false
  }
}

const saveDrill = async () => {
  await persistDrill('save')
}

const submitDrill = async () => {
  await persistDrill('submit')
}

onMounted(() => {
  loadDrill()
})
</script>

<style scoped>
.drill-page {
  min-height: 100%;
  padding: 24px;
  display: grid;
  gap: 16px;
  background: transparent;
  color: var(--app-text);
}

.drill-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.drill-header h1,
.section-heading h2,
.drill-card h3,
.summary-card strong {
  margin: 0;
}

.drill-eyebrow,
.drill-subtitle,
.detail-copy,
.item-subtitle {
  margin: 0;
}

.drill-eyebrow {
  font-size: 12px;
  color: var(--app-text-soft);
}

.drill-subtitle {
  margin-top: 6px;
  color: var(--app-text-muted);
  max-width: 720px;
}

.drill-band {
  padding: 20px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-card,
.drill-card {
  min-width: 0;
  padding: 16px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.summary-card span,
.block-label {
  font-size: 12px;
  color: var(--app-text-soft);
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  color: var(--app-text-strong);
}

.summary-card p {
  margin: 8px 0 0;
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

.drill-list {
  display: grid;
  gap: 16px;
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
}

.item-subtitle {
  margin-top: 8px;
  color: var(--app-text-soft);
  font-size: 13px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-size: 12px;
}

.chip-warning {
  background: var(--app-chip-warn-bg);
  color: var(--app-chip-warn-text);
}

.detail-block {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.detail-copy {
  color: var(--app-text-muted);
  line-height: 1.6;
}

.detail-copy-strong {
  color: var(--app-text-strong);
  font-weight: 600;
}

.answer-field {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.answer-field span {
  font-size: 13px;
  color: var(--app-text-muted);
}

.draft-input {
  width: 100%;
  min-height: 96px;
  padding: 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-card-bg);
  color: var(--app-text-strong);
  box-sizing: border-box;
  font: inherit;
  resize: vertical;
}

.answer-reference-block {
  padding-top: 12px;
  border-top: 1px dashed var(--app-border);
}

@media (max-width: 900px) {
  .drill-header,
  .summary-grid {
    grid-template-columns: 1fr;
    display: grid;
  }

  .header-actions {
    width: 100%;
  }
}
</style>
