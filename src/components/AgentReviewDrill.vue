<template>
  <div class="drill-page">
    <header class="drill-header">
      <div>
        <p class="drill-eyebrow">Codex Study Loop</p>
        <h1>Agent Review Drill</h1>
        <p class="drill-subtitle">
          Work through structured review variants, keep a draft if needed, then submit the drill
          packet back to the repo.
        </p>
      </div>
      <div class="header-actions">
        <el-button :loading="isSaving" @click="saveDrill">Save Draft</el-button>
        <el-button type="primary" :loading="isSubmitting" @click="submitDrill">Submit Drill</el-button>
        <el-button :loading="isLoading" @click="loadDrill">Refresh</el-button>
      </div>
    </header>

    <section v-if="isLoading" class="drill-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="drill-band">
      <el-alert :closable="false" show-icon title="Load failed" type="error" :description="loadError" />
    </section>

    <template v-else-if="reviewDrill">
      <section class="drill-band summary-grid">
        <article class="summary-card">
          <span>Drill Status</span>
          <strong>{{ reviewDrill.status }}</strong>
          <p>{{ reviewDrill.summary.title }}</p>
        </article>
        <article class="summary-card">
          <span>Focus Items</span>
          <strong>{{ reviewDrill.items.length }}</strong>
          <p>{{ reviewDrill.summary.focus.join(" / ") || "No focus tags" }}</p>
        </article>
        <article class="summary-card">
          <span>Latest Review</span>
          <strong>{{ latestReviewId }}</strong>
          <p>{{ latestReviewAccuracy }}</p>
        </article>
      </section>

      <section v-if="actionMessage" class="drill-band action-band">
        <el-alert :closable="false" show-icon title="Review drill updated" type="success" :description="actionMessage" />
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>Structured Drill Packet</h2>
          <span>{{ reviewDrill.items.length }} items</span>
        </div>
        <div class="drill-list">
          <article v-for="item in reviewDrill.items" :key="item.id" class="drill-card">
            <div class="item-head">
              <div>
                <h3>{{ formatQueueKey(item.key) }}</h3>
                <p class="item-subtitle">
                  lesson {{ item.lesson }} · {{ item.target_grammar }} · {{ item.status }}
                </p>
              </div>
              <el-tag size="small" :type="item.status === 'submitted' ? 'success' : 'warning'" effect="plain">
                {{ item.review_queue_id }}
              </el-tag>
            </div>

            <div class="detail-block">
              <p class="block-label">Weakness Explanation</p>
              <p class="detail-copy">{{ item.weakness_explanation }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">Recent Error Tags</p>
              <div class="chip-row">
                <span v-for="tag in item.error_tags" :key="tag" class="chip chip-warning">{{ tag }}</span>
              </div>
            </div>

            <div class="detail-block">
              <p class="block-label">Original Prompt</p>
              <p class="detail-copy">{{ item.original_prompt }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">Variant Drill Prompt</p>
              <p class="detail-copy detail-copy-strong">{{ item.variant_prompt }}</p>
            </div>

            <div v-if="item.hint" class="detail-block">
              <p class="block-label">Hint</p>
              <p class="detail-copy">{{ item.hint }}</p>
            </div>

            <label class="answer-field">
              <span>Your Review Answer</span>
              <textarea
                class="draft-input"
                :value="item.user_answer"
                rows="4"
                placeholder="Write a fresh answer for this review variant."
                @input="updateAnswer(item.id, $event.target.value)"
              />
            </label>

            <div class="detail-block answer-reference-block">
              <p class="block-label">Answer Reference</p>
              <p class="detail-copy">{{ item.answer_reference }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>Due Queue Snapshot</h2>
          <span>{{ dueItems.length }} due</span>
        </div>
        <div v-if="dueItems.length" class="chip-row">
          <span v-for="item in dueItems" :key="item.id" class="chip">
            {{ formatQueueKey(item.key) }} · {{ item.last_result }} · due {{ item.due_date }}
          </span>
        </div>
        <el-empty v-else description="No due review items are waiting right now." />
      </section>
    </template>

    <section v-else class="drill-band">
      <el-empty description="No review drill packet is available yet." />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import { createAgentStudyClient } from "@/utils/agentStudyClient"

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const isLoading = ref(true)
const isSaving = ref(false)
const isSubmitting = ref(false)
const loadError = ref("")
const actionMessage = ref("")
const progressPayload = ref(null)
const reviewDrill = ref(null)
const reviewDrillPath = ref("")

const client = computed(() => props.client || createAgentStudyClient())

const latestReviewId = computed(() => progressPayload.value?.reviewResult?.id || "No review yet")
const latestReviewAccuracy = computed(() => {
  const value = progressPayload.value?.reviewResult?.overall?.accuracy
  if (typeof value !== "number" || Number.isNaN(value)) return "No review accuracy yet"
  return `accuracy ${Math.round(value * 100)}%`
})
const dueItems = computed(() =>
  (progressPayload.value?.reviewQueue?.items || []).filter((item) => item.status === "due")
)

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
      user_answer: item.user_answer || ""
    }))
  }
}

const loadDrill = async () => {
  isLoading.value = true
  loadError.value = ""
  actionMessage.value = ""

  try {
    const [nextProgressPayload, latestReviewDrill] = await Promise.all([
      client.value.loadProgressReview(),
      client.value.loadLatestReviewDrill()
    ])
    progressPayload.value = nextProgressPayload
    hydrateReviewDrill(latestReviewDrill)
    reviewDrillPath.value = latestReviewDrill?.date
      ? `study/review-drills/${latestReviewDrill.date}.json`
      : ""
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const formatQueueKey = (value) => String(value || "").replaceAll("/", " / ")

const updateAnswer = (itemId, value) => {
  if (!reviewDrill.value) return

  reviewDrill.value = {
    ...reviewDrill.value,
    items: reviewDrill.value.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            user_answer: String(value || "")
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

  if (mode === "save") {
    isSaving.value = true
  } else {
    isSubmitting.value = true
  }
  loadError.value = ""
  actionMessage.value = ""

  try {
    const result =
      mode === "save"
        ? await client.value.saveReviewDrill(requestPayload)
        : await client.value.submitReviewDrill(requestPayload)

    hydrateReviewDrill(result.reviewDrill)
    reviewDrillPath.value = result.targetPath || reviewDrillPath.value
    actionMessage.value =
      mode === "save"
        ? "Draft answers were saved to the review drill packet."
        : "Review drill answers were submitted successfully."
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
    isSubmitting.value = false
  }
}

const saveDrill = async () => {
  await persistDrill("save")
}

const submitDrill = async () => {
  await persistDrill("submit")
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
  background: #f5f7fb;
  color: #1f2937;
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
  text-transform: uppercase;
  color: #64748b;
}

.drill-subtitle {
  margin-top: 6px;
  color: #475569;
  max-width: 720px;
}

.drill-band {
  padding: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #dbe3f1;
  border-radius: 8px;
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
  background: #fbfdff;
  border: 1px solid #dbe3f1;
  border-radius: 8px;
}

.summary-card span,
.block-label {
  font-size: 12px;
  color: #64748b;
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  color: #0f172a;
}

.summary-card p {
  margin: 8px 0 0;
  color: #475569;
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
  color: #64748b;
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
  color: #64748b;
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
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
}

.chip-warning {
  background: #fff7ed;
  color: #b45309;
}

.detail-block {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.detail-copy {
  color: #334155;
  line-height: 1.6;
}

.detail-copy-strong {
  color: #0f172a;
  font-weight: 600;
}

.answer-field {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.answer-field span {
  font-size: 13px;
  color: #475569;
}

.draft-input {
  width: 100%;
  min-height: 96px;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  box-sizing: border-box;
  font: inherit;
  resize: vertical;
}

.answer-reference-block {
  padding-top: 12px;
  border-top: 1px dashed #dbe3f1;
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
