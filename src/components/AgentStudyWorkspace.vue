<template>
  <div class="agent-study-page">
    <header class="agent-study-header">
      <div>
        <p class="agent-study-eyebrow">Codex Study Loop</p>
        <h1>Agent Study Workspace</h1>
        <p class="agent-study-subtitle">Today's packet, materials, and draft answers live here.</p>
      </div>
      <div class="header-actions">
        <el-button :loading="isLoading" @click="loadWorkspace">Refresh</el-button>
        <el-button
          type="primary"
          :loading="isSaving"
          :disabled="isSaveDisabled"
          @click="saveDraft"
        >
          Save Draft
        </el-button>
      </div>
    </header>

    <section v-if="isLoading" class="agent-study-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="agent-study-band">
      <el-alert :closable="false" show-icon title="Load failed" type="error" :description="loadError" />
    </section>

    <section v-else-if="!dailyPacket" class="agent-study-band">
      <el-empty description="No daily packet is available right now." />
    </section>

    <template v-else>
      <section class="agent-study-band agent-study-overview">
        <div class="overview-copy">
          <p class="agent-study-eyebrow">Today's Mission</p>
          <h2>{{ missionTitle }}</h2>
          <p>{{ missionSummary }}</p>
        </div>
        <div class="overview-meta">
          <div class="meta-item">
            <span>Date</span>
            <strong>{{ dailyPacket.date || "--" }}</strong>
          </div>
          <div class="meta-item">
            <span>Status</span>
            <el-tag :type="statusTagType" effect="plain">{{ dailyPacket.status || "unknown" }}</el-tag>
          </div>
          <div class="meta-item">
            <span>Planned Time</span>
            <strong>{{ availableMinutesLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>Focus Lessons</span>
            <strong>{{ focusLessonsLabel }}</strong>
          </div>
        </div>
      </section>

      <section v-if="saveError" class="agent-study-band">
        <el-alert :closable="false" show-icon title="Draft save failed" type="error" :description="saveError" />
      </section>

      <section v-else-if="saveMessage" class="agent-study-band">
        <el-alert :closable="false" show-icon title="Draft saved" type="success" :description="saveMessage" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>Task List</h2>
          <span>{{ taskCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.tasks?.length" class="item-grid">
          <article v-for="task in dailyPacket.tasks" :key="task.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ task.title || task.id }}</h3>
              <el-tag size="small" effect="plain">{{ task.status || "pending" }}</el-tag>
            </div>
            <p class="item-type">{{ task.type || "task" }}</p>
            <p class="item-note">{{ task.minutes ? `${task.minutes} min` : "Time TBD" }}</p>
          </article>
        </div>
        <el-empty v-else description="No tasks are listed for today." />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>Study Materials</h2>
          <span>{{ materialCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.study_materials?.length" class="item-grid">
          <article v-for="material in dailyPacket.study_materials" :key="material.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ material.title || material.id }}</h3>
              <el-tag size="small" effect="plain">{{ material.type || "material" }}</el-tag>
            </div>
            <p class="item-type">Lesson {{ material.lesson ?? "--" }}</p>
            <p class="item-copy">{{ material.content || "No material summary yet." }}</p>
            <ul v-if="material.examples?.length" class="example-list">
              <li v-for="(example, index) in material.examples" :key="`${material.id}-${index}`">
                <strong>{{ example.ja || "Example" }}</strong>
                <span>{{ example.zh || example.note || "" }}</span>
              </li>
            </ul>
          </article>
        </div>
        <el-empty v-else description="No study materials are available yet." />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>Exercises</h2>
          <span>{{ exerciseCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.exercises?.length" class="exercise-list">
          <article v-for="exercise in dailyPacket.exercises" :key="exercise.id" class="exercise-card">
            <div class="item-card-top">
              <div>
                <h3>{{ exercise.prompt || exercise.id }}</h3>
                <p class="item-type">{{ exercise.target_grammar || "No grammar label" }}</p>
              </div>
              <el-tag size="small" type="success" effect="plain">{{ exercise.type || "exercise" }}</el-tag>
            </div>
            <p class="item-note">
              Lesson {{ exercise.lesson ?? "--" }} · {{ exercise.metadata?.skill || "unlabeled skill" }}
            </p>
            <p v-if="exercise.vocab_hints?.length" class="item-copy">
              Hints: {{ exercise.vocab_hints.join(" / ") }}
            </p>

            <label class="answer-field">
              <span>Draft Answer</span>
              <el-input
                v-if="exercise.type === 'q_fill'"
                :model-value="getAnswerValue(exercise.id)"
                placeholder="Type a short answer"
                @update:model-value="updateAnswer(exercise.id, $event)"
              />
              <el-input
                v-else
                type="textarea"
                :rows="exercise.type === 'q_conversation' ? 4 : 3"
                :model-value="getAnswerValue(exercise.id)"
                :placeholder="answerPlaceholder(exercise.type)"
                @update:model-value="updateAnswer(exercise.id, $event)"
              />
            </label>
          </article>
        </div>
        <el-empty v-else description="No exercises are available yet." />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>Review Hints</h2>
          <span>{{ reviewItemCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.review_items?.length || indexDocument?.latest_review || reviewResult" class="review-summary">
          <div class="meta-item">
            <span>Queued Review Items</span>
            <strong>{{ reviewItemCountLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>Latest Review</span>
            <strong>{{ indexDocument?.latest_review || "None yet" }}</strong>
          </div>
          <div class="meta-item">
            <span>Correction Status</span>
            <strong>{{ dailyPacket.correction?.status || "pending" }}</strong>
          </div>
        </div>
        <el-empty v-else description="No review hints are available yet." />
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
const isSaving = ref(false)
const loadError = ref("")
const saveError = ref("")
const saveMessage = ref("")
const indexDocument = ref(null)
const dailyPacket = ref(null)
const reviewResult = ref(null)
const answerDrafts = ref({})

const client = computed(() => props.client || createAgentStudyClient())

const missionTitle = computed(() => dailyPacket.value?.mission?.title || "Unnamed Study Packet")
const missionSummary = computed(() => {
  const mission = dailyPacket.value?.mission
  if (!mission) return "No study mission is available yet."

  const goals = Array.isArray(mission.goals) ? mission.goals.filter(Boolean) : []
  return goals.length ? goals.join(" | ") : "Start with the packet and build momentum from there."
})

const availableMinutesLabel = computed(() => {
  const minutes = dailyPacket.value?.mission?.available_minutes
  return typeof minutes === "number" ? `${minutes} min` : "--"
})

const focusLessonsLabel = computed(() => {
  const lessons = dailyPacket.value?.mission?.focus_lessons
  return Array.isArray(lessons) && lessons.length ? lessons.join(", ") : "--"
})

const statusTagType = computed(() => {
  const status = dailyPacket.value?.status
  if (status === "submitted" || status === "reviewed") return "success"
  if (status === "answering" || status === "learning") return "warning"
  return "info"
})

const taskCountLabel = computed(() => `${dailyPacket.value?.tasks?.length || 0} items`)
const materialCountLabel = computed(() => `${dailyPacket.value?.study_materials?.length || 0} items`)
const exerciseCountLabel = computed(() => `${dailyPacket.value?.exercises?.length || 0} items`)
const reviewItemCountLabel = computed(() => `${dailyPacket.value?.review_items?.length || 0} items`)

const hasDraftChanges = computed(() => {
  if (!dailyPacket.value) return false

  const originalAnswers = dailyPacket.value.answers || {}
  const draftAnswers = answerDrafts.value || {}
  const keys = new Set([...Object.keys(originalAnswers), ...Object.keys(draftAnswers)])

  for (const key of keys) {
    if (String(originalAnswers[key] || "") !== String(draftAnswers[key] || "")) {
      return true
    }
  }

  return false
})

const isSaveDisabled = computed(() => !dailyPacket.value || isLoading.value || isSaving.value || !hasDraftChanges.value)

const buildAnswerDrafts = (packet) => {
  const nextAnswers = { ...(packet?.answers || {}) }

  for (const exercise of packet?.exercises || []) {
    if (typeof nextAnswers[exercise.id] !== "string") {
      nextAnswers[exercise.id] = ""
    }
  }

  return nextAnswers
}

const applyWorkspacePayload = (payload) => {
  indexDocument.value = payload?.index || null
  dailyPacket.value = payload?.dailyPacket || null
  reviewResult.value = payload?.reviewResult || null
  answerDrafts.value = buildAnswerDrafts(payload?.dailyPacket)
}

const getAnswerValue = (exerciseId) => answerDrafts.value?.[exerciseId] || ""

const answerPlaceholder = (exerciseType) => {
  if (exerciseType === "q_conversation") return "Write a natural reply draft"
  if (exerciseType === "q_translate") return "Write your translation draft"
  return "Write your answer"
}

const updateAnswer = (exerciseId, value) => {
  answerDrafts.value = {
    ...answerDrafts.value,
    [exerciseId]: typeof value === "string" ? value : ""
  }
  saveMessage.value = ""
  saveError.value = ""
}

const loadWorkspace = async () => {
  isLoading.value = true
  loadError.value = ""

  try {
    const payload = await client.value.loadLatestAgentStudy()
    applyWorkspacePayload(payload)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const buildDraftPacket = () => {
  const currentPacket = dailyPacket.value
  if (!currentPacket) return null

  const nextStatus =
    currentPacket.status === "planned" || currentPacket.status === "learning"
      ? "answering"
      : currentPacket.status

  return {
    ...currentPacket,
    status: nextStatus,
    answers: { ...answerDrafts.value }
  }
}

const saveDraft = async () => {
  const nextPacket = buildDraftPacket()
  if (!nextPacket) return

  isSaving.value = true
  saveError.value = ""
  saveMessage.value = ""

  try {
    const result = await client.value.saveDailyPacket({
      dailyPacket: nextPacket
    })

    dailyPacket.value = result?.dailyPacket || nextPacket
    answerDrafts.value = buildAnswerDrafts(dailyPacket.value)
    saveMessage.value = "Draft answers were saved. Refresh is available if you want to confirm the latest copy."
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/revision|conflict/i.test(message)) {
      saveError.value = "Draft save hit a revision conflict. Please refresh to load the latest packet before saving again."
    } else {
      saveError.value = message
    }
  } finally {
    isSaving.value = false
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

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: end;
}

.agent-study-header h1,
.section-heading h2,
.overview-copy h2,
.item-card h3,
.exercise-card h3 {
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

.item-card,
.exercise-card {
  min-width: 0;
  padding: 16px;
  background: #fbfdff;
  border: 1px solid #dbe3f1;
  border-radius: 8px;
}

.exercise-list {
  display: grid;
  gap: 16px;
}

.item-card-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.item-card h3,
.exercise-card h3 {
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

.answer-field {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.answer-field span {
  font-size: 13px;
  color: #475569;
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

  .header-actions {
    justify-content: start;
  }
}
</style>
