<template>
  <div class="agent-study-page">
    <header class="agent-study-header">
      <div>
        <p class="agent-study-eyebrow">Codex Study Loop</p>
        <h1>学习工作台</h1>
        <p class="agent-study-subtitle">今天的学习包、资料、作答草稿和最近批改结果都集中在这里。</p>
      </div>
      <div class="header-actions">
        <el-button data-action="refresh" :loading="isLoading" @click="loadWorkspace">刷新</el-button>
        <el-button data-action="save-daily" type="primary" :loading="isSaving" :disabled="isSaveDisabled" @click="saveDraft">
          保存草稿
        </el-button>
        <el-button data-action="submit-daily" type="success" :loading="isSubmitting" :disabled="isSubmitDisabled" @click="submitPacket">
          提交学习包
        </el-button>
      </div>
    </header>

    <section v-if="!isLoading && !loadError" class="agent-study-band phase-band">
      <div class="phase-copy">
        <p class="agent-study-eyebrow">当前阶段 · 第 {{ phaseDetails.step }} / 5 步</p>
        <h2>{{ phaseDetails.label }}</h2>
        <p>{{ phaseDescription }}</p>
      </div>
      <div class="phase-action">
        <span v-if="dailyPacket && phase === PHASES.STUDYING">已完成 {{ answeredExerciseCount }} / {{ dailyPacket.exercises?.length || 0 }} 题</span>
        <el-button data-action="phase-primary" type="primary" :loading="isCopyingPrompt" @click="runPrimaryPhaseAction">
          {{ phaseDetails.action }}
        </el-button>
      </div>
    </section>

    <section v-if="isLoading" class="agent-study-band">
      <el-skeleton :rows="8" animated />
    </section>

    <section v-else-if="loadError" class="agent-study-band">
      <el-alert :closable="false" show-icon title="加载失败" type="error" :description="loadError" />
    </section>

    <section v-else-if="!dailyPacket" class="agent-study-band">
      <el-empty description="当前还没有可用的每日学习包。" />
      <div class="empty-agent-handoff">
        <p class="item-copy">
          请先把生成学习包提示词交给编辑器里的 Codex。Codex 会读取项目文件并写入新的
          daily packet，之后刷新本页即可开始学习。
        </p>
        <el-button data-action="create-packet" type="primary" :loading="isCopyingPrompt" @click="copyCreateDailyPacketPrompt">
          复制生成学习包提示词
        </el-button>
      </div>
      <p v-if="promptCopyMessage" class="prompt-feedback success-copy">{{ promptCopyMessage }}</p>
      <p v-if="promptError" class="prompt-feedback error-copy">{{ promptError }}</p>
      <pre v-if="promptPreview" class="prompt-preview">{{ promptPreview }}</pre>
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
            <el-tag :type="statusTagType" effect="plain">{{ statusText }}</el-tag>
          </div>
          <div class="meta-item">
            <span>计划时长</span>
            <strong>{{ availableMinutesLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>聚焦课程</span>
            <strong>{{ focusLessonsLabel }}</strong>
          </div>
        </div>
      </section>

      <section v-if="saveError" class="agent-study-band">
        <el-alert :closable="false" show-icon title="草稿保存失败" type="error" :description="saveError" />
      </section>

      <section v-else-if="saveMessage" class="agent-study-band">
        <el-alert :closable="false" show-icon title="草稿已保存" type="success" :description="saveMessage" />
      </section>

      <section v-if="submitError" class="agent-study-band">
        <el-alert :closable="false" show-icon title="提交失败" type="error" :description="submitError" />
      </section>

      <section v-else-if="submitMessage" class="agent-study-band">
        <el-alert :closable="false" show-icon title="学习包已提交" type="success" :description="submitMessage" />
      </section>

      <section v-if="promptCopyMessage || promptError" class="agent-study-band prompt-status-band">
        <p v-if="promptCopyMessage" class="prompt-feedback success-copy">{{ promptCopyMessage }}</p>
        <p v-if="promptError" class="prompt-feedback error-copy">{{ promptError }}</p>
      </section>

      <section id="exercise-section" class="agent-study-band">
        <div class="section-heading">
          <h2>任务清单</h2>
          <span>{{ taskCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.tasks?.length" class="item-grid">
          <article v-for="task in dailyPacket.tasks" :key="task.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ task.title || task.id }}</h3>
              <el-tag size="small" effect="plain">{{ mapStatusLabel(task.status) }}</el-tag>
            </div>
            <p class="item-type">{{ task.type || '任务' }}</p>
            <p class="item-note">{{ task.minutes ? `${task.minutes} 分钟` : '时长待定' }}</p>
          </article>
        </div>
        <el-empty v-else description="今天还没有安排任务。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>学习资料</h2>
          <span>{{ materialCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.study_materials?.length" class="item-grid">
          <article v-for="material in dailyPacket.study_materials" :key="material.id" class="item-card">
            <div class="item-card-top">
              <h3>{{ material.title || material.id }}</h3>
              <el-tag size="small" effect="plain">{{ material.type || '资料' }}</el-tag>
            </div>
            <p class="item-type">第 {{ material.lesson ?? '--' }} 课</p>
            <p class="item-copy">{{ material.content || '暂时还没有资料摘要。' }}</p>
            <ul v-if="material.examples?.length" class="example-list">
              <li v-for="(example, index) in material.examples" :key="`${material.id}-${index}`">
                <strong>{{ example.ja || '例句' }}</strong>
                <span>{{ example.zh || example.note || '' }}</span>
              </li>
            </ul>
          </article>
        </div>
        <el-empty v-else description="当前还没有可用学习资料。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>练习题</h2>
          <span>{{ exerciseCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.exercises?.length" class="exercise-list">
          <article v-for="exercise in dailyPacket.exercises" :key="exercise.id" class="exercise-card">
            <div class="item-card-top">
              <div>
                <h3>{{ exercise.prompt || exercise.id }}</h3>
                <p class="item-type">{{ exercise.target_grammar || '未标注语法点' }}</p>
              </div>
              <el-tag size="small" type="success" effect="plain">{{ exercise.type || '练习' }}</el-tag>
            </div>
            <p class="item-note">第 {{ exercise.lesson ?? '--' }} 课 · {{ exercise.metadata?.skill || '未标注技能' }}</p>
            <div class="exercise-detail-list">
              <p v-if="exercise.instruction" class="item-copy"><strong>作答要求：</strong>{{ exercise.instruction }}</p>
              <p v-if="exercise.context_note" class="item-copy"><strong>场景说明：</strong>{{ exercise.context_note }}</p>
              <p v-if="exercise.answer_format" class="item-copy"><strong>回答格式：</strong>{{ exercise.answer_format }}</p>
            </div>

            <div v-if="exercise.supporting_lines?.length" class="supporting-lines">
              <p class="supporting-title">对话上下文</p>
              <ul class="supporting-list">
                <li v-for="(line, index) in exercise.supporting_lines" :key="`${exercise.id}-line-${index}`">
                  {{ line }}
                </li>
              </ul>
            </div>

            <div v-if="exercise.choices?.length" class="choice-row">
              <span v-for="choice in exercise.choices" :key="`${exercise.id}-${choice}`" class="choice-chip">
                {{ choice }}
              </span>
            </div>

            <p v-if="exercise.vocab_hints?.length" class="item-copy">可用词：{{ exercise.vocab_hints.join(' / ') }}</p>

            <label class="answer-field">
              <span>作答草稿</span>
              <el-input
                v-if="exercise.type === 'q_fill'"
                :model-value="getAnswerValue(exercise.id)"
                placeholder="请输入简短答案"
                :disabled="!canEditPacket"
                @update:model-value="updateAnswer(exercise.id, $event)"
              />
              <el-input
                v-else
                type="textarea"
                :rows="exercise.type === 'q_conversation' ? 4 : 3"
                :model-value="getAnswerValue(exercise.id)"
                :placeholder="answerPlaceholder(exercise.type)"
                :disabled="!canEditPacket"
                @update:model-value="updateAnswer(exercise.id, $event)"
              />
            </label>
          </article>
        </div>
        <el-empty v-else description="当前还没有可用练习题。" />
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>自我评估</h2>
          <span>提交前必填</span>
        </div>
        <div class="assessment-grid">
          <label class="answer-field">
            <span>难度感受</span>
            <select class="assessment-input" :value="selfAssessmentDraft.difficulty" @change="updateDifficulty($event.target.value)">
              <option value="">请选择</option>
              <option value="easy">轻松</option>
              <option value="steady">适中</option>
              <option value="hard">吃力</option>
            </select>
          </label>

          <label class="answer-field">
            <span>节奏</span>
            <input
              class="assessment-input"
              :value="selfAssessmentDraft.pace"
              placeholder="例如：适中、偏快、偏慢"
              @input="updateAssessmentField('pace', $event.target.value)"
            />
          </label>
        </div>

        <div class="assessment-grid">
          <label class="answer-field">
            <span>困惑点</span>
            <textarea
              class="assessment-input assessment-textarea"
              :value="confusingPointsText"
              rows="3"
              placeholder="每行填写一个困惑点"
              @input="updateConfusingPoints($event.target.value)"
            />
          </label>

          <label class="answer-field">
            <span>补充说明</span>
            <textarea
              class="assessment-input assessment-textarea"
              :value="selfAssessmentDraft.note"
              rows="3"
              placeholder="填写你希望 Codex 批改前知道的内容"
              @input="updateAssessmentField('note', $event.target.value)"
            />
          </label>
        </div>

        <div v-if="dailyPacket.exercises?.length" class="uncertain-block">
          <p class="uncertain-title">勾选你仍然不确定的题目</p>
          <label v-for="exercise in dailyPacket.exercises" :key="`uncertain-${exercise.id}`" class="uncertain-item">
            <input
              type="checkbox"
              :checked="selfAssessmentDraft.uncertain_exercise_ids.includes(exercise.id)"
              @change="toggleUncertainExercise(exercise.id, $event.target.checked)"
            />
            <span>{{ exercise.prompt || exercise.id }}</span>
          </label>
        </div>
      </section>

      <section class="agent-study-band">
        <div class="section-heading">
          <h2>批改提示</h2>
          <span>{{ reviewItemCountLabel }}</span>
        </div>
        <div v-if="dailyPacket.review_items?.length || reviewResult || dailyPacket.correction?.review_file" class="review-summary">
          <div class="meta-item">
            <span>待批改项目</span>
            <strong>{{ reviewItemCountLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>当前包批改</span>
            <strong>{{ dailyPacket.correction?.review_file || '尚未批改' }}</strong>
          </div>
          <div class="meta-item">
            <span>批改状态</span>
            <strong>{{ mapStatusLabel(dailyPacket.correction?.status) }}</strong>
          </div>
        </div>
        <el-empty v-else description="当前还没有批改提示。" />
      </section>

      <section v-if="reviewResult" class="agent-study-band">
        <div class="section-heading">
          <h2>最近批改结果</h2>
          <span>共检查 {{ reviewItems.length }} 题</span>
        </div>

        <div class="review-summary review-overall-grid">
          <div class="meta-item">
            <span>正确率</span>
            <strong>{{ reviewAccuracyLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>推进建议</span>
            <strong>{{ reviewPromotionLabel }}</strong>
          </div>
          <div class="meta-item">
            <span>批改文件</span>
            <strong>{{ reviewFilePath }}</strong>
          </div>
          <div class="meta-item">
            <span>生成时间</span>
            <strong>{{ reviewResult.created_at || '--' }}</strong>
          </div>
        </div>

        <div class="review-overall-copy">
          <div>
            <p class="review-block-label">总结</p>
            <p class="item-copy">{{ reviewResult.overall?.summary || '暂时还没有批改总结。' }}</p>
          </div>
          <div>
            <p class="review-block-label">下一步重点</p>
            <ul v-if="reviewNextFocus.length" class="review-focus-list">
              <li v-for="focus in reviewNextFocus" :key="focus">{{ focus }}</li>
            </ul>
            <p v-else class="item-note">暂时没有记录下一步重点。</p>
          </div>
          <div>
            <p class="review-block-label">推进原因</p>
            <p class="item-copy">{{ reviewResult.promotion_decision?.reason || '暂时还没有推进说明。' }}</p>
          </div>
        </div>

        <div class="review-item-list">
          <article v-for="item in reviewItems" :key="item.exercise_id" class="exercise-card review-item-card">
            <div class="item-card-top">
              <div>
                <h3>{{ reviewExercisePrompt(item) }}</h3>
                <p class="item-type">{{ item.target_grammar || reviewExerciseType(item.exercise_id) }}</p>
              </div>
              <el-tag size="small" :type="item.is_correct ? 'success' : 'danger'" effect="plain">
                {{ item.is_correct ? '正确' : '需重做' }}
              </el-tag>
            </div>

            <div class="review-chip-row">
              <span class="review-chip">得分 {{ formatPercent(item.score) }}</span>
              <span class="review-chip">置信度 {{ formatPercent(item.confidence) }}</span>
              <span v-if="item.retry_recommended" class="review-chip review-chip-warning">建议重做</span>
              <span v-if="item.needs_user_input" class="review-chip review-chip-warning">需要补充信息</span>
            </div>

            <p v-if="item.error_tags?.length" class="item-note">标签：{{ item.error_tags.join(', ') }}</p>
            <p v-else class="item-note">标签：无</p>

            <div class="review-answer-block">
              <p class="review-block-label">你的答案</p>
              <p class="item-copy">{{ item.user_answer || getAnswerValue(item.exercise_id) || '--' }}</p>
            </div>

            <div class="review-answer-block">
              <p class="review-block-label">参考答案</p>
              <p class="item-copy">{{ item.correct_answer || '暂无参考答案。' }}</p>
            </div>

            <div class="review-answer-block">
              <p class="review-block-label">说明</p>
              <p class="item-copy">{{ item.explanation || '暂无说明。' }}</p>
            </div>

            <div v-if="item.acceptable_variants?.length" class="review-answer-block">
              <p class="review-block-label">可接受变体</p>
              <ul class="review-focus-list">
                <li v-for="variant in item.acceptable_variants" :key="variant">{{ variant }}</li>
              </ul>
            </div>

            <div v-if="item.rubric && Object.keys(item.rubric).length" class="review-answer-block">
              <p class="review-block-label">评分维度</p>
              <div class="rubric-grid">
                <div v-for="(value, key) in item.rubric" :key="`${item.exercise_id}-${key}`" class="rubric-item">
                  <span>{{ key }}</span>
                  <strong>{{ formatPercent(value) }}</strong>
                </div>
              </div>
            </div>

            <div class="review-answer-block">
              <p class="review-block-label">人工覆盖</p>
              <p class="item-note">{{ formatManualOverride(item.manual_override) }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="showSubmissionNextStep" class="agent-study-band next-step-band">
        <div class="section-heading">
          <h2>交给 Codex 批改</h2>
          <span>批改交接</span>
        </div>
        <div class="prompt-handoff">
          <p class="item-copy">
            学习包已经提交。请复制下面的完整提示词，回到编辑器交给 Codex；Codex 会读取本次提交、
            写入批改结果，并更新下一步学习状态。
          </p>
          <div class="handoff-meta">
            <div class="meta-item">
              <span>Daily</span>
              <strong>{{ submittedDailyPath }}</strong>
            </div>
            <div class="meta-item">
              <span>Prompt</span>
              <strong>{{ submittedReviewPromptPath }}</strong>
            </div>
          </div>
          <div class="answer-summary-block">
            <p class="review-block-label">本次答案摘要</p>
            <pre class="answer-summary-preview">{{ submittedAnswerSummary }}</pre>
          </div>
          <div class="header-actions prompt-actions">
            <el-button data-action="copy-review" type="primary" :loading="isCopyingPrompt" @click="copyReviewPrompt">
              复制批改提示词
            </el-button>
          </div>
        </div>
        <p v-if="promptCopyMessage" class="prompt-feedback success-copy">{{ promptCopyMessage }}</p>
        <p v-if="promptError" class="prompt-feedback error-copy">{{ promptError }}</p>
        <pre class="prompt-preview">{{ reviewHandoffPrompt }}</pre>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { createAgentStudyClient } from '@/utils/agentStudyClient'
import { PHASES, deriveAgentStudyPhase, getAgentStudyPhaseDetails } from '@/utils/agentStudyPhase'
import {
  buildAnswerSummary,
  buildCreateDailyPacketPrompt,
  buildReviewSubmittedPacketPrompt
} from '@/utils/agentStudyPromptText'
import { toKanaInput } from '@/utils/wanakanaInput'

const props = defineProps({
  client: {
    type: Object,
    default: null
  },
  copyText: {
    type: Function,
    default: null
  }
})

const isLoading = ref(true)
const isSaving = ref(false)
const isSubmitting = ref(false)
const isCopyingPrompt = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveMessage = ref('')
const submitError = ref('')
const submitMessage = ref('')
const promptError = ref('')
const promptCopyMessage = ref('')
const promptPreview = ref('')
const indexDocument = ref(null)
const dailyPacket = ref(null)
const reviewResult = ref(null)
const serverPhase = ref('')
const answerDrafts = ref({})
const selfAssessmentDraft = ref({
  difficulty: '',
  uncertain_exercise_ids: [],
  confusing_points: [],
  pace: '',
  note: ''
})

const client = computed(() => props.client || createAgentStudyClient())

const statusLabelMap = {
  planned: '已计划',
  learning: '学习中',
  answering: '作答中',
  submitted: '已提交',
  reviewed: '已批改',
  pending: '待处理',
  done: '已完成',
  draft: '草稿',
  unknown: '未知'
}

const resolveCopyText = async (value) => {
  if (typeof props.copyText === 'function') {
    await props.copyText(value)
    return
  }

  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  throw new Error('当前环境不支持剪贴板写入。')
}

const missionTitle = computed(() => dailyPacket.value?.mission?.title || '未命名学习包')
const missionSummary = computed(() => {
  const mission = dailyPacket.value?.mission
  if (!mission) return '当前还没有学习任务说明。'

  const goals = Array.isArray(mission.goals) ? mission.goals.filter(Boolean) : []
  return goals.length ? goals.join(' | ') : '先从当前学习包开始，逐步进入状态。'
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

const statusText = computed(() => mapStatusLabel(dailyPacket.value?.status))
const taskCountLabel = computed(() => `${dailyPacket.value?.tasks?.length || 0} 项`)
const materialCountLabel = computed(() => `${dailyPacket.value?.study_materials?.length || 0} 项`)
const exerciseCountLabel = computed(() => `${dailyPacket.value?.exercises?.length || 0} 题`)
const reviewItemCountLabel = computed(() => `${dailyPacket.value?.review_items?.length || 0} 项`)
const showSubmissionNextStep = computed(() => dailyPacket.value?.status === 'submitted')
const confusingPointsText = computed(() => selfAssessmentDraft.value.confusing_points.join('\n'))
const reviewItems = computed(() => (Array.isArray(reviewResult.value?.items) ? reviewResult.value.items : []))
const reviewNextFocus = computed(() =>
  Array.isArray(reviewResult.value?.overall?.next_focus) ? reviewResult.value.overall.next_focus : []
)
const reviewAccuracyLabel = computed(() => formatPercent(reviewResult.value?.overall?.accuracy))
const reviewPromotionLabel = computed(() =>
  reviewResult.value?.promotion_decision?.can_advance ? '可以推进' : '暂不推进'
)
const reviewFilePath = computed(
  () => dailyPacket.value?.correction?.review_file || '暂无'
)
const phase = computed(() =>
  serverPhase.value || deriveAgentStudyPhase({ dailyPacket: dailyPacket.value, reviewResult: reviewResult.value })
)
const phaseDetails = computed(() => getAgentStudyPhaseDetails(phase.value))
const answeredExerciseCount = computed(() =>
  (dailyPacket.value?.exercises || []).filter((exercise) => String(answerDrafts.value?.[exercise.id] || '').trim()).length
)
const canEditPacket = computed(() => ['planned', 'learning', 'answering', 'draft'].includes(dailyPacket.value?.status))
const hasCompleteAnswers = computed(() =>
  Boolean(dailyPacket.value?.exercises?.length) && answeredExerciseCount.value === dailyPacket.value.exercises.length
)
const hasRequiredAssessment = computed(() => Boolean(selfAssessmentDraft.value.difficulty))
const phaseDescription = computed(() => {
  if (phase.value === PHASES.STUDYING && dailyPacket.value) {
    return `当前是第 ${focusLessonsLabel.value} 课学习包。完成全部题目和难度自评后即可提交。`
  }
  return phaseDetails.value.description
})
const createDailyPacketPrompt = computed(() => buildCreateDailyPacketPrompt())
const submittedDailyPath = computed(() =>
  indexDocument.value?.latest_daily || (dailyPacket.value?.date ? `study/daily/${dailyPacket.value.date}.json` : 'study/daily/YYYY-MM-DD.json')
)
const submittedReviewPromptPath = computed(() =>
  dailyPacket.value?.correction?.prompt_file ||
  indexDocument.value?.latest_prompt ||
  'study/prompts/generated/YYYY-MM-DD-review.md'
)
const submittedAnswerSummary = computed(() => buildAnswerSummary(dailyPacket.value))
const reviewHandoffPrompt = computed(() =>
  buildReviewSubmittedPacketPrompt({
    dailyPacket: dailyPacket.value,
    indexDocument: {
      ...(indexDocument.value || {}),
      latest_daily: submittedDailyPath.value,
      latest_prompt: submittedReviewPromptPath.value
    }
  })
)

const hasDraftChanges = computed(() => {
  if (!dailyPacket.value) return false

  const originalAnswers = dailyPacket.value.answers || {}
  const draftAnswers = answerDrafts.value || {}
  const keys = new Set([...Object.keys(originalAnswers), ...Object.keys(draftAnswers)])

  for (const key of keys) {
    if (String(originalAnswers[key] || '') !== String(draftAnswers[key] || '')) {
      return true
    }
  }

  return false
})

const isSaveDisabled = computed(() => !canEditPacket.value || isLoading.value || isSaving.value || !hasDraftChanges.value)
const isSubmitDisabled = computed(() =>
  !canEditPacket.value ||
  !hasCompleteAnswers.value ||
  !hasRequiredAssessment.value ||
  isLoading.value ||
  isSaving.value ||
  isSubmitting.value
)

const buildAnswerDrafts = (packet) => {
  const nextAnswers = { ...(packet?.answers || {}) }

  for (const exercise of packet?.exercises || []) {
    if (typeof nextAnswers[exercise.id] !== 'string') {
      nextAnswers[exercise.id] = ''
    }
  }

  return nextAnswers
}

const buildSelfAssessmentDraft = (packet) => ({
  difficulty: packet?.self_assessment?.difficulty || '',
  uncertain_exercise_ids: Array.isArray(packet?.self_assessment?.uncertain_exercise_ids)
    ? [...packet.self_assessment.uncertain_exercise_ids]
    : [],
  confusing_points: Array.isArray(packet?.self_assessment?.confusing_points)
    ? [...packet.self_assessment.confusing_points]
    : [],
  pace: packet?.self_assessment?.pace || '',
  note: packet?.self_assessment?.note || ''
})

const applyWorkspacePayload = (payload) => {
  indexDocument.value = payload?.index || null
  dailyPacket.value = payload?.dailyPacket || null
  reviewResult.value = payload?.reviewResult || null
  serverPhase.value = payload?.phase || ''
  answerDrafts.value = buildAnswerDrafts(payload?.dailyPacket)
  selfAssessmentDraft.value = buildSelfAssessmentDraft(payload?.dailyPacket)
}

const mapStatusLabel = (status) => statusLabelMap[status || 'unknown'] || String(status || '未知')
const getAnswerValue = (exerciseId) => answerDrafts.value?.[exerciseId] || ''

const answerPlaceholder = (exerciseType) => {
  if (exerciseType === 'q_conversation') return '请输入自然的日语对话回复'
  if (exerciseType === 'q_translate') return '请输入你的日语翻译草稿'
  return '请输入答案'
}

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value * 100)}%`
}

const findExercise = (exerciseId) =>
  dailyPacket.value?.exercises?.find((exercise) => exercise.id === exerciseId) || null

const reviewExercisePrompt = (item) => {
  const exercise = findExercise(item.exercise_id)
  return exercise?.prompt || item.exercise_id || '批改项目'
}

const reviewExerciseType = (exerciseId) => {
  const exercise = findExercise(exerciseId)
  return exercise?.type || '练习'
}

const formatManualOverride = (manualOverride) => {
  if (!manualOverride) return '暂无人工覆盖记录。'
  if (typeof manualOverride === 'string') return manualOverride
  if (typeof manualOverride === 'object') {
    return manualOverride.reason || manualOverride.summary || JSON.stringify(manualOverride)
  }
  return String(manualOverride)
}

const resetTransientMessages = () => {
  promptCopyMessage.value = ''
  promptError.value = ''
  submitMessage.value = ''
  saveMessage.value = ''
  submitError.value = ''
  saveError.value = ''
}

const updateAnswer = (exerciseId, value) => {
  answerDrafts.value = {
    ...answerDrafts.value,
    [exerciseId]: typeof value === 'string' ? toKanaInput(value) : ''
  }
  resetTransientMessages()
}

const updateAssessmentField = (field, value) => {
  selfAssessmentDraft.value = {
    ...selfAssessmentDraft.value,
    [field]: typeof value === 'string' ? value : ''
  }
  resetTransientMessages()
}

const updateDifficulty = (value) => {
  updateAssessmentField('difficulty', value || '')
}

const updateConfusingPoints = (value) => {
  selfAssessmentDraft.value = {
    ...selfAssessmentDraft.value,
    confusing_points: String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  resetTransientMessages()
}

const toggleUncertainExercise = (exerciseId, checked) => {
  const nextIds = new Set(selfAssessmentDraft.value.uncertain_exercise_ids)
  if (checked) {
    nextIds.add(exerciseId)
  } else {
    nextIds.delete(exerciseId)
  }

  selfAssessmentDraft.value = {
    ...selfAssessmentDraft.value,
    uncertain_exercise_ids: [...nextIds]
  }
  resetTransientMessages()
}

const loadWorkspace = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const payload = await client.value.loadLatestAgentStudy()
    applyWorkspacePayload(payload)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const buildWritablePacket = (statusOverride = null) => {
  const currentPacket = dailyPacket.value
  if (!currentPacket) return null

  const nextStatus =
    statusOverride ||
    (currentPacket.status === 'planned' || currentPacket.status === 'learning' ? 'answering' : currentPacket.status)

  return {
    ...currentPacket,
    status: nextStatus,
    answers: { ...answerDrafts.value },
    self_assessment: {
      difficulty: selfAssessmentDraft.value.difficulty || null,
      uncertain_exercise_ids: [...selfAssessmentDraft.value.uncertain_exercise_ids],
      confusing_points: [...selfAssessmentDraft.value.confusing_points],
      pace: selfAssessmentDraft.value.pace,
      note: selfAssessmentDraft.value.note
    }
  }
}

const saveDraft = async () => {
  const nextPacket = buildWritablePacket()
  if (!nextPacket) return

  isSaving.value = true
  saveError.value = ''
  saveMessage.value = ''

  try {
    const result = await client.value.saveDailyPacket({
      dailyPacket: nextPacket
    })

    dailyPacket.value = result?.dailyPacket || nextPacket
    answerDrafts.value = buildAnswerDrafts(dailyPacket.value)
    saveMessage.value = '作答草稿已保存；如果想确认最新版本，可以再刷新一次。'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/revision|conflict/i.test(message)) {
      saveError.value = '保存时遇到版本冲突，请先刷新加载最新学习包后再重试。'
    } else {
      saveError.value = message
    }
  } finally {
    isSaving.value = false
  }
}

const submitPacket = async () => {
  const nextPacket = buildWritablePacket('submitted')
  if (!nextPacket) return

  isSubmitting.value = true
  submitError.value = ''
  submitMessage.value = ''
  saveError.value = ''

  try {
    const result = await client.value.submitDailyPacket({
      dailyPacket: nextPacket
    })

    dailyPacket.value = result?.dailyPacket || nextPacket
    answerDrafts.value = buildAnswerDrafts(dailyPacket.value)
    selfAssessmentDraft.value = buildSelfAssessmentDraft(dailyPacket.value)
    submitMessage.value = '学习包已提交。下方已经生成批改提示词，请复制给编辑器里的 Codex。'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/revision|conflict/i.test(message)) {
      submitError.value = '提交时遇到版本冲突，请先刷新加载最新学习包后再重试。'
    } else {
      submitError.value = message
    }
  } finally {
    isSubmitting.value = false
  }
}

const copyPromptText = async (content, successMessage) => {
  promptError.value = ''
  promptCopyMessage.value = ''
  isCopyingPrompt.value = true

  try {
    promptPreview.value = content
    await resolveCopyText(content)
    promptCopyMessage.value = successMessage
  } catch (error) {
    promptError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isCopyingPrompt.value = false
  }
}

const copyCreateDailyPacketPrompt = async () => {
  await copyPromptText(
    createDailyPacketPrompt.value,
    '生成学习包提示词已复制。请回到编辑器交给 Codex。'
  )
}

const copyReviewPrompt = async () => {
  await copyPromptText(
    reviewHandoffPrompt.value,
    '批改提示词已复制。请回到编辑器交给 Codex。'
  )
}

const runPrimaryPhaseAction = async () => {
  if (phase.value === PHASES.NEEDS_PACKET || phase.value === PHASES.READY_FOR_NEXT) {
    await copyCreateDailyPacketPrompt()
    return
  }
  if (phase.value === PHASES.AWAITING_REVIEW) {
    await copyReviewPrompt()
    return
  }
  if (phase.value === PHASES.REVIEW_DUE) {
    window.location.hash = '#/agent-review-drill'
    return
  }
  document.querySelector('#exercise-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  background: transparent;
  color: var(--app-text);
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

.phase-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-left: 4px solid var(--app-accent);
}

.phase-copy {
  min-width: 0;
}

.phase-copy h2,
.phase-copy p {
  margin: 0;
}

.phase-copy h2 {
  margin: 4px 0 6px;
}

.phase-copy > p:last-child {
  color: var(--app-text-muted);
  line-height: 1.5;
}

.phase-action {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  color: var(--app-text-soft);
  font-size: 13px;
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

.agent-study-eyebrow,
.review-block-label {
  font-size: 12px;
  color: var(--app-text-soft);
}

.agent-study-subtitle {
  margin-top: 6px;
  color: var(--app-text-muted);
}

.agent-study-band {
  padding: 20px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
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
  color: var(--app-text-muted);
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
  background: var(--app-soft-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.meta-item span {
  font-size: 12px;
  color: var(--app-text-soft);
}

.meta-item strong {
  font-size: 15px;
  color: var(--app-text-strong);
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

.item-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.item-card,
.exercise-card {
  min-width: 0;
  padding: 16px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
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
  color: var(--app-accent);
  font-size: 13px;
}

.item-note {
  margin-top: 6px;
  color: var(--app-text-soft);
  font-size: 13px;
}

.item-copy {
  margin-top: 10px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.answer-field {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.exercise-detail-list,
.supporting-lines {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.supporting-title {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-soft);
}

.supporting-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  display: grid;
  gap: 6px;
}

.choice-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.choice-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--app-soft-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 12px;
}

.assessment-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.assessment-input {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-card-bg);
  color: var(--app-text-strong);
  box-sizing: border-box;
  font: inherit;
}

.assessment-textarea {
  min-height: 88px;
  resize: vertical;
}

.uncertain-block {
  margin-top: 18px;
  display: grid;
  gap: 10px;
}

.uncertain-title {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.uncertain-item {
  display: flex;
  align-items: start;
  gap: 10px;
  color: var(--app-text-muted);
}

.next-step-band strong {
  color: var(--app-text-strong);
}

.review-overall-grid {
  margin-bottom: 16px;
}

.review-overall-copy,
.review-item-list {
  display: grid;
  gap: 16px;
}

.review-item-list {
  margin-top: 16px;
}

.review-item-card {
  display: grid;
  gap: 12px;
}

.review-chip-row,
.rubric-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-size: 12px;
}

.review-chip-warning {
  background: var(--app-chip-warn-bg);
  color: var(--app-chip-warn-text);
}

.review-answer-block {
  display: grid;
  gap: 6px;
}

.review-focus-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  display: grid;
  gap: 8px;
}

.rubric-item {
  min-width: 0;
  padding: 10px 12px;
  background: var(--app-soft-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.rubric-item span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.rubric-item strong {
  color: var(--app-text-strong);
  font-size: 13px;
}

.prompt-handoff,
.empty-agent-handoff {
  display: grid;
  gap: 12px;
}

.empty-agent-handoff {
  margin-top: 16px;
  justify-items: start;
}

.handoff-meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.answer-summary-block {
  display: grid;
  gap: 8px;
}

.answer-summary-preview {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-soft-bg);
  color: var(--app-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  line-height: 1.6;
}

.prompt-actions {
  justify-content: start;
}

.prompt-feedback {
  margin: 0;
  font-size: 13px;
}

.prompt-status-band {
  padding-top: 14px;
  padding-bottom: 14px;
}

.success-copy {
  color: var(--app-success);
}

.error-copy {
  color: var(--app-danger);
}

.prompt-preview {
  margin: 12px 0 0;
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

.answer-field span {
  font-size: 13px;
  color: var(--app-text-muted);
}

.example-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--app-text-muted);
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
  .review-summary,
  .handoff-meta,
  .assessment-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    justify-content: start;
  }

  .phase-band,
  .phase-action {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
