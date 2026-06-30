<template>
  <div class="progress-page">
    <header class="progress-header">
      <div>
        <p class="progress-eyebrow">Codex Study Loop</p>
        <h1>Agent Progress Review</h1>
        <p class="progress-subtitle">A compact view of learner state, queue pressure, and the next Codex handoff.</p>
      </div>
      <el-button :loading="isLoading" @click="loadProgress">Refresh</el-button>
    </header>

    <section v-if="isLoading" class="progress-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="progress-band">
      <el-alert :closable="false" show-icon title="Load failed" type="error" :description="loadError" />
    </section>

    <template v-else-if="progressPayload">
      <section class="progress-band summary-grid">
        <article class="summary-card">
          <span>Current Lesson</span>
          <strong>{{ progressPayload.current?.current_lesson ?? "--" }}</strong>
          <p>{{ progressPayload.current?.learning_mode || "No learning mode" }}</p>
        </article>
        <article class="summary-card">
          <span>Daily Budget</span>
          <strong>{{ dailyBudgetLabel }}</strong>
          <p>{{ progressPayload.profile?.pace_preference || "No pace preference" }}</p>
        </article>
        <article class="summary-card">
          <span>Due Reviews</span>
          <strong>{{ dueQueueCount }}</strong>
          <p>{{ scheduledQueueCount }} scheduled behind it</p>
        </article>
        <article class="summary-card">
          <span>Promotion</span>
          <strong>{{ promotionLabel }}</strong>
          <p>{{ promotionReasonPreview }}</p>
        </article>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Learner Profile</h2>
          <span>{{ progressPayload.profile?.learner_id || "--" }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>Goals</h3>
            <ul v-if="profileGoals.length" class="detail-list">
              <li v-for="goal in profileGoals" :key="goal">{{ goal }}</li>
            </ul>
            <p v-else class="detail-note">No explicit goals recorded.</p>
          </article>
          <article class="detail-card">
            <h3>Learning Preferences</h3>
            <dl class="meta-list">
              <div>
                <dt>Series</dt>
                <dd>{{ progressPayload.profile?.material_scope?.series || "--" }}</dd>
              </div>
              <div>
                <dt>Allow New Lessons</dt>
                <dd>{{ boolLabel(progressPayload.profile?.material_scope?.allow_new_lessons) }}</dd>
              </div>
              <div>
                <dt>Romaji</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.allow_romaji) }}</dd>
              </div>
              <div>
                <dt>Kana First</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.prefer_kana_first) }}</dd>
              </div>
              <div>
                <dt>Practice Kanji</dt>
                <dd>{{ boolLabel(progressPayload.profile?.input_preferences?.practice_kanji) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Mastery Snapshot</h2>
          <span>{{ progressPayload.mastery?.current_gate || "--" }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>Lesson States</h3>
            <div class="lesson-state-list">
              <div v-for="lessonState in lessonStates" :key="lessonState.key" class="lesson-state-item">
                <div class="item-head">
                  <strong>Lesson {{ lessonState.lesson }}</strong>
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
            <h3>Weak Grammar</h3>
            <div v-if="weakGrammarPoints.length" class="grammar-list">
              <div v-for="point in weakGrammarPoints" :key="point.key" class="grammar-item">
                <div class="item-head">
                  <strong>{{ point.pattern }}</strong>
                  <el-tag size="small" effect="plain">{{ point.status }}</el-tag>
                </div>
                <p class="detail-note">Lesson {{ point.lesson }} · controlled {{ formatPercent(point.controlled_output) }} · free {{ formatPercent(point.free_output) }}</p>
              </div>
            </div>
            <p v-else class="detail-note">No weak grammar points recorded.</p>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Review Queue</h2>
          <span>{{ queueItems.length }} items</span>
        </div>
        <div v-if="queueItems.length" class="queue-list">
          <article v-for="item in queueItems" :key="item.id" class="queue-item">
            <div class="item-head">
              <strong>{{ item.key }}</strong>
              <el-tag size="small" :type="item.status === 'due' ? 'danger' : 'info'" effect="plain">{{ item.status }}</el-tag>
            </div>
            <p class="detail-note">Due {{ item.due_date }} · {{ item.last_result }} · interval {{ item.interval_days }}d · ease {{ item.ease }}</p>
          </article>
        </div>
        <el-empty v-else description="No review queue items are available." />
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Promotion Decision</h2>
          <span>{{ latestReviewId }}</span>
        </div>
        <div class="detail-grid two-up">
          <article class="detail-card">
            <h3>Latest Review</h3>
            <p class="detail-copy">{{ progressPayload.reviewResult?.overall?.summary || "No review summary yet." }}</p>
            <p class="detail-note">Accuracy {{ formatPercent(progressPayload.reviewResult?.overall?.accuracy) }}</p>
          </article>
          <article class="detail-card">
            <h3>Gate Status</h3>
            <p class="detail-copy">{{ progressPayload.reviewResult?.promotion_decision?.reason || "No promotion decision yet." }}</p>
            <ul v-if="nextFocus.length" class="detail-list">
              <li v-for="focus in nextFocus" :key="focus">{{ focus }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Recent Events</h2>
          <span>{{ recentEvents.length }} recent</span>
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
        <el-empty v-else description="No event log entries are available." />
      </section>

      <section class="progress-band">
        <div class="section-heading">
          <h2>Next Agent Context</h2>
          <span>{{ progressPayload.nextAgentContext?.path || "--" }}</span>
        </div>
        <pre class="context-preview">{{ progressPayload.nextAgentContext?.content || "No next-agent-context content is available." }}</pre>
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

const client = computed(() => props.client || createAgentStudyClient())

const queueItems = computed(() => progressPayload.value?.reviewQueue?.items || [])
const dueQueueCount = computed(() => queueItems.value.filter((item) => item.status === "due").length)
const scheduledQueueCount = computed(() => queueItems.value.filter((item) => item.status !== "due").length)
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
    .filter((point) => point.status === "weak" || point.status === "learning" || point.status === "decayed")
    .sort((left, right) => left.controlled_output - right.controlled_output)
    .slice(0, 6)
)
const latestReviewId = computed(() => progressPayload.value?.reviewResult?.id || "No review yet")
const promotionLabel = computed(() =>
  progressPayload.value?.reviewResult?.promotion_decision?.can_advance ? "Ready" : "Hold"
)
const promotionReasonPreview = computed(() => {
  const reason = progressPayload.value?.reviewResult?.promotion_decision?.reason || "No promotion signal yet."
  return reason.length > 72 ? `${reason.slice(0, 72)}...` : reason
})
const dailyBudgetLabel = computed(() => {
  const value = progressPayload.value?.profile?.daily_time_budget_minutes
  return typeof value === "number" ? `${value} min` : "--"
})

const formatPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--"
  return `${Math.round(value * 100)}%`
}

const boolLabel = (value) => (value ? "Yes" : "No")

const loadProgress = async () => {
  isLoading.value = true
  loadError.value = ""

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
  background: #f5f7fb;
  color: #1f2937;
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
  text-transform: uppercase;
  color: #64748b;
}

.progress-subtitle {
  margin-top: 6px;
  color: #475569;
}

.progress-band {
  padding: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #dbe3f1;
  border-radius: 8px;
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
  background: #fbfdff;
  border: 1px solid #dbe3f1;
  border-radius: 8px;
}

.summary-card span,
.meta-list dt,
.event-meta {
  font-size: 12px;
  color: #64748b;
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  color: #0f172a;
}

.summary-card p,
.detail-note {
  margin-top: 8px;
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

.two-up {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-card {
  display: grid;
  gap: 12px;
}

.detail-copy {
  color: #334155;
  line-height: 1.6;
}

.detail-list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
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
  color: #0f172a;
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
  color: #334155;
  font-size: 13px;
}

.context-preview {
  margin: 0;
  padding: 14px;
  border: 1px solid #dbe3f1;
  border-radius: 8px;
  background: #f8fafc;
  color: #1e293b;
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
