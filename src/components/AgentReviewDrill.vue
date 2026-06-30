<template>
  <div class="drill-page">
    <header class="drill-header">
      <div>
        <p class="drill-eyebrow">Codex Study Loop</p>
        <h1>Agent Review Drill</h1>
        <p class="drill-subtitle">Work the due review queue first, with light drill placeholders until structured drill packets arrive.</p>
      </div>
      <el-button :loading="isLoading" @click="loadDrill">Refresh</el-button>
    </header>

    <section v-if="isLoading" class="drill-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="drill-band">
      <el-alert :closable="false" show-icon title="Load failed" type="error" :description="loadError" />
    </section>

    <template v-else-if="progressPayload">
      <section class="drill-band summary-grid">
        <article class="summary-card">
          <span>Due Now</span>
          <strong>{{ dueItems.length }}</strong>
          <p>{{ totalQueueCount }} total queue items</p>
        </article>
        <article class="summary-card">
          <span>Current Lesson</span>
          <strong>{{ progressPayload.current?.current_lesson ?? "--" }}</strong>
          <p>{{ progressPayload.current?.learning_mode || "No learning mode" }}</p>
        </article>
        <article class="summary-card">
          <span>Latest Review</span>
          <strong>{{ latestReviewId }}</strong>
          <p>{{ latestReviewAccuracy }}</p>
        </article>
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>Due Review Queue</h2>
          <span>{{ dueItems.length }} due</span>
        </div>
        <div v-if="dueItems.length" class="drill-list">
          <article v-for="item in dueItems" :key="item.id" class="drill-card">
            <div class="item-head">
              <div>
                <h3>{{ formatQueueKey(item.key) }}</h3>
                <p class="item-subtitle">{{ item.kind }} · due {{ item.due_date }}</p>
              </div>
              <el-tag size="small" type="danger" effect="plain">{{ item.last_result }}</el-tag>
            </div>

            <div class="chip-row">
              <span class="chip">interval {{ item.interval_days }}d</span>
              <span class="chip">ease {{ item.ease }}</span>
              <span class="chip">status {{ item.status }}</span>
            </div>

            <div class="detail-block">
              <p class="block-label">Grammar Point</p>
              <p class="detail-copy">{{ findGrammarPoint(item.key)?.pattern || item.key }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">Recent Error Cause</p>
              <p class="detail-copy">{{ deriveErrorCause(item) }}</p>
            </div>

            <div class="detail-block">
              <p class="block-label">Latest Review Hint</p>
              <p class="detail-copy">{{ deriveReviewHint(item) }}</p>
            </div>

            <label class="answer-field">
              <span>Drill Notes / Placeholder Answer</span>
              <textarea
                class="draft-input"
                :value="draftAnswers[item.id] || ''"
                rows="4"
                placeholder="Write a fresh sentence, note the contrast, or leave yourself a retry cue."
                @input="updateDraft(item.id, $event.target.value)"
              />
            </label>
          </article>
        </div>
        <el-empty v-else description="No due review items are waiting right now." />
      </section>

      <section class="drill-band">
        <div class="section-heading">
          <h2>Recent Error Tags</h2>
          <span>{{ recentErrorTags.length }} tags</span>
        </div>
        <div v-if="recentErrorTags.length" class="chip-row">
          <span v-for="tag in recentErrorTags" :key="tag" class="chip chip-warning">{{ tag }}</span>
        </div>
        <el-empty v-else description="No recent error tags are available." />
      </section>
    </template>
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
const loadError = ref("")
const progressPayload = ref(null)
const draftAnswers = ref({})

const client = computed(() => props.client || createAgentStudyClient())

const queueItems = computed(() => progressPayload.value?.reviewQueue?.items || [])
const dueItems = computed(() => queueItems.value.filter((item) => item.status === "due"))
const totalQueueCount = computed(() => queueItems.value.length)
const reviewItems = computed(() => progressPayload.value?.reviewResult?.items || [])
const grammarPoints = computed(() => progressPayload.value?.mastery?.grammar_points || {})
const latestReviewId = computed(() => progressPayload.value?.reviewResult?.id || "No review yet")
const latestReviewAccuracy = computed(() => {
  const value = progressPayload.value?.reviewResult?.overall?.accuracy
  if (typeof value !== "number" || Number.isNaN(value)) return "No review accuracy yet"
  return `accuracy ${Math.round(value * 100)}%`
})
const recentErrorTags = computed(() =>
  [...new Set(reviewItems.value.flatMap((item) => item.error_tags || []))].slice(0, 8)
)

const loadDrill = async () => {
  isLoading.value = true
  loadError.value = ""

  try {
    progressPayload.value = await client.value.loadProgressReview()
    draftAnswers.value = Object.fromEntries(
      (progressPayload.value?.reviewQueue?.items || []).map((item) => [item.id, draftAnswers.value[item.id] || ""])
    )
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const formatQueueKey = (value) => String(value || "").replaceAll("/", " / ")

const findGrammarPoint = (key) => grammarPoints.value?.[key] || null

const updateDraft = (id, value) => {
  draftAnswers.value = {
    ...draftAnswers.value,
    [id]: String(value || "")
  }
}

const deriveMatchingReviewItems = (queueItem) => {
  const grammarPoint = findGrammarPoint(queueItem.key)
  const lesson = grammarPoint?.lesson
  const pattern = grammarPoint?.pattern

  return reviewItems.value.filter((item) => {
    if (pattern && item.target_grammar === pattern) return true
    if (lesson != null && item.target_grammar?.includes(String(lesson))) return true
    return item.retry_recommended || !item.is_correct
  })
}

const deriveErrorCause = (queueItem) => {
  const matches = deriveMatchingReviewItems(queueItem)
  const tags = [...new Set(matches.flatMap((item) => item.error_tags || []))]

  if (tags.length > 0) {
    return tags.join(", ")
  }

  return `Last result was ${queueItem.last_result}.`
}

const deriveReviewHint = (queueItem) => {
  const match = deriveMatchingReviewItems(queueItem)[0]
  if (!match) {
    return "No direct review hint is available yet."
  }

  return match.explanation || match.correct_answer || "Retry with a fresh variation."
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

@media (max-width: 900px) {
  .drill-header,
  .summary-grid {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
