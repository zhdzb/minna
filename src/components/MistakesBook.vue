<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div class="mistake-header">
          <div>
            <div class="mistake-title">错题本</div>
            <div class="mistake-subtitle">管理完整题库，每次只练一小组。</div>
          </div>
          <div class="mistake-header-actions">
            <el-button
              v-if="mistakeSession.status === 'active'"
              type="primary"
              @click="continueTraining"
            >
              继续本次训练 {{ sessionProgressLabel }}
            </el-button>
            <el-button type="danger" plain @click="clearAll" :disabled="legacyItems.length === 0">
              清空旧记录
            </el-button>
          </div>
        </div>
      </template>

      <div class="mistake-toolbar">
        <label>
          查看
          <select v-model="bookView" class="mistake-select">
            <option value="active">待练错题</option>
            <option value="mastered">已经掌握</option>
            <option value="dismissed">已移出</option>
          </select>
        </label>
        <label v-if="bookView === 'active'">
          本次题数
          <select v-model.number="trainingSize" class="mistake-select">
            <option :value="3">3 题</option>
            <option :value="5">5 题</option>
            <option :value="10">10 题</option>
          </select>
        </label>
        <label>
          课次
          <select v-model="lessonFilter" class="mistake-select">
            <option value="all">全部</option>
            <option v-for="lesson in lessonOptions" :key="lesson" :value="String(lesson)">
              第 {{ lesson }} 课
            </option>
          </select>
        </label>
        <label>
          来源
          <select v-model="sourceFilter" class="mistake-select">
            <option value="all">全部</option>
            <option value="automatic">自动错题</option>
            <option value="manual">手动加入</option>
          </select>
        </label>
        <label>
          错误标签
          <select v-model="errorTagFilter" class="mistake-select">
            <option value="all">全部</option>
            <option v-for="tag in errorTagOptions" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>
        <label>
          到期状态
          <select v-model="dueFilter" class="mistake-select">
            <option value="all">全部</option>
            <option value="due">已到期</option>
            <option value="not_due">未到期 / 未关联</option>
          </select>
        </label>
        <el-button
          v-if="bookView === 'active'"
          type="primary"
          :disabled="agentItems.length === 0"
          :loading="isStartingSession"
          @click="startTraining"
        >
          开始本次训练
        </el-button>
        <el-button
          v-if="bookView === 'active' && selectedAgentIds.length"
          type="danger"
          plain
          @click="batchDismiss"
        >
          批量移出（{{ selectedAgentIds.length }}）
        </el-button>
        <el-button
          v-if="bookView === 'dismissed' && selectedAgentIds.length"
          type="success"
          plain
          @click="batchRestore"
        >
          批量恢复（{{ selectedAgentIds.length }}）
        </el-button>
        <span class="mistake-total">当前视图 {{ tableData.length }} 题</span>
      </div>

      <el-alert
        v-if="tableData.length === 0"
        :title="emptyTitle"
        type="success"
        :description="emptyDescription"
        show-icon
        :closable="false"
      />

      <el-table
        v-else
        class="mistake-desktop-table"
        :data="tableData"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'timestamp', order: 'descending' }"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="timestamp" label="记录时间" width="170" sortable>
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>

        <el-table-column prop="lesson" label="课次" width="90" sortable>
          <template #default="{ row }">
            <el-tag size="small">第 {{ row.lesson }} 课</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="来源" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source_type === 'agent-study' ? 'danger' : 'info'">
              {{ sourceLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="question_type" label="题型" width="130" />
        <el-table-column prop="grammar_point" label="语法点" min-width="180" show-overflow-tooltip />
        <el-table-column prop="original_question" label="题目" min-width="220" show-overflow-tooltip />
        <el-table-column label="练习次数" width="100">
          <template #default="{ row }">
            {{ row.attempts?.length || 0 }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div style="display: flex; gap: 8px;">
              <el-button
                v-if="bookView !== 'dismissed'"
                size="small"
                type="primary"
                plain
                @click="openReview(row)"
                :disabled="!row.exercise_snapshot"
              >
                重新做
              </el-button>
              <el-button
                v-if="row.source_type === 'agent-study' && bookView === 'active'"
                size="small"
                type="danger"
                plain
                @click="dismissAgentMistake(row.id)"
              >
                移出错题本
              </el-button>
              <el-button
                v-else-if="row.source_type === 'agent-study' && bookView === 'dismissed'"
                size="small"
                type="success"
                plain
                @click="restoreAgentMistake(row.id)"
              >
                恢复
              </el-button>
              <el-button
                v-else-if="row.source_type !== 'agent-study'"
                size="small"
                type="danger"
                plain
                @click="removeMistake(row.id)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="tableData.length" class="mistake-mobile-list">
        <article v-for="row in tableData" :key="`mobile-${row.id}`" class="mistake-mobile-item">
          <div class="mistake-mobile-meta">
            <el-tag size="small">第 {{ row.lesson }} 课</el-tag>
            <el-tag size="small" :type="row.source_type === 'agent-study' ? 'danger' : 'info'">
              {{ sourceLabel(row) }}
            </el-tag>
            <span>练习 {{ row.attempts?.length || 0 }} 次</span>
          </div>
          <strong>{{ row.original_question }}</strong>
          <span class="mistake-mobile-grammar">{{ row.grammar_point }}</span>
          <div class="mistake-mobile-actions">
            <el-button
              v-if="bookView !== 'dismissed'"
              size="small"
              type="primary"
              plain
              @click="openReview(row)"
              :disabled="!row.exercise_snapshot"
            >
              重新做
            </el-button>
            <el-button
              v-if="row.source_type === 'agent-study' && bookView === 'active'"
              size="small"
              type="danger"
              plain
              @click="dismissAgentMistake(row.id)"
            >
              移出错题本
            </el-button>
            <el-button
              v-else-if="row.source_type === 'agent-study' && bookView === 'dismissed'"
              size="small"
              type="success"
              plain
              @click="restoreAgentMistake(row.id)"
            >
              恢复
            </el-button>
            <el-button
              v-else-if="row.source_type !== 'agent-study'"
              size="small"
              type="danger"
              plain
              @click="removeMistake(row.id)"
            >
              删除
            </el-button>
          </div>
        </article>
      </div>
    </el-card>

    <el-dialog
      v-model="reviewDialogVisible"
      :title="isSessionReview ? `错题训练 ${sessionProgressLabel}` : '单题复习'"
      width="720px"
      destroy-on-close
    >
      <div v-if="activeReviewItem && reviewExercise">
        <div style="margin-bottom: 12px;">
          <el-tag size="small" type="info">{{ activeReviewItem.question_type || reviewExercise.type }}</el-tag>
          <el-tag size="small" style="margin-left: 8px;">第 {{ activeReviewItem.lesson }} 课</el-tag>
        </div>

        <div style="font-size: 1rem; font-weight: 600; line-height: 1.7; margin-bottom: 16px;">
          {{ reviewExercise.prompt || reviewExercise.question || reviewExercise.chinese_prompt || reviewExercise.scene_description }}
        </div>

        <div
          v-if="reviewExercise.instruction || reviewExercise.context_note"
          style="background: #f7f8fa; border: 1px solid #ebeef5; border-radius: 8px; padding: 14px; margin-bottom: 16px;"
        >
          <p v-if="reviewExercise.instruction" style="margin: 0 0 8px; line-height: 1.7;">
            {{ reviewExercise.instruction }}
          </p>
          <p v-if="reviewExercise.context_note" style="margin: 0; color: #606266; line-height: 1.7;">
            {{ reviewExercise.context_note }}
          </p>
        </div>

        <div v-if="reviewExercise.supporting_lines?.length" style="margin-bottom: 16px;">
          <p style="font-size: 0.85rem; color: #909399;">题目材料</p>
          <p
            v-for="(line, index) in reviewExercise.supporting_lines"
            :key="`supporting-${index}`"
            style="margin: 6px 0; line-height: 1.7;"
          >
            {{ line }}
          </p>
        </div>

        <div v-if="reviewExercise.metadata?.audio_text" style="margin-bottom: 16px;">
          <el-button type="primary" plain @click="playAudio(reviewExercise.metadata.audio_text)">
            播放题目音频
          </el-button>
          <label style="margin-left: 12px; font-size: 0.9rem; color: #606266;">
            语速
            <select v-model.number="speechRate" style="margin-left: 6px;">
              <option :value="0.75">0.75x</option>
              <option :value="0.85">0.85x</option>
              <option :value="1">1.0x</option>
            </select>
          </label>
        </div>

        <div
          v-if="reviewExercise.type === 'q_conversation'"
          style="background: #f7f8fa; border: 1px solid #ebeef5; border-radius: 8px; padding: 14px; margin-bottom: 16px;"
        >
          <div
            v-for="(turn, index) in reviewExercise.turns"
            :key="`${turn.speaker}-${index}`"
            style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px;"
          >
            <el-tag size="small" :type="turn.speaker === 'A' ? '' : 'success'">{{ turn.speaker }}</el-tag>
            <span v-if="index !== reviewExercise.missing_turn_index">{{ turn.content }}</span>
            <span v-else style="color: #409eff; font-weight: 600;">(请补全这一句)</span>
          </div>
        </div>

        <div v-if="reviewExercise.vocab_hints?.length" style="margin-bottom: 16px;">
          <div style="font-size: 0.85rem; color: #909399; margin-bottom: 8px;">词汇提示</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <div
              v-for="(hint, index) in reviewExercise.vocab_hints"
              :key="`hint-${index}`"
              style="padding: 8px 10px; border-radius: 8px; background: #f5f7fa; border: 1px solid #ebeef5;"
            >
              {{ formatVocabHint(hint) }}
            </div>
          </div>
        </div>

        <div v-if="reviewExercise.type === 'q_fill'" style="margin-bottom: 16px;">
          <el-radio-group v-model="reviewAnswer">
            <el-radio-button
              v-for="option in reviewOptions"
              :key="option"
              :label="option"
            />
          </el-radio-group>
        </div>

        <div v-else style="margin-bottom: 16px;">
          <el-input
            :model-value="reviewAnswer"
            type="textarea"
            :rows="4"
            @update:model-value="updateReviewAnswer"
            placeholder="在这里重新作答"
          />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-size: 0.85rem; color: #909399;">
            开放题会显示参考答案和解析，主要用于复盘，不做严格自动判卷。
          </div>
          <div style="display: flex; gap: 8px;">
            <el-button @click="reviewDialogVisible = false">暂停</el-button>
            <el-button v-if="isSessionReview" plain @click="endTraining">结束本次</el-button>
            <el-button
              type="primary"
              :loading="isSubmittingAttempt"
              :disabled="!reviewAnswer.trim()"
              @click="submitReview"
            >
              提交并查看答案
            </el-button>
          </div>
        </div>

        <el-alert
          v-if="reviewSubmitted"
          :type="reviewResultType"
          :closable="false"
          style="margin-bottom: 12px;"
        >
          <template #title>
            {{ reviewResultText }}
          </template>
        </el-alert>

        <el-card v-if="reviewSubmitted" shadow="never" style="background: #fafafa;">
          <div v-if="activeReviewItem.user_wrong_input" style="margin-bottom: 10px;">
            <strong>上次错答：</strong>
            <span>{{ activeReviewItem.user_wrong_input }}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <strong>参考答案：</strong>
            <span>{{ activeReviewItem.correct_answer }}</span>
            <el-button
              v-if="activeReviewItem.correct_answer"
              size="small"
              circle
              @click="playAudio(activeReviewItem.correct_answer)"
            >
              听
            </el-button>
          </div>
          <div v-if="activeReviewItem.explanation">
            <strong>解析：</strong>
            <div v-html="activeReviewItem.explanation" style="margin-top: 6px; line-height: 1.7;" />
          </div>
          <div v-if="activeReviewItem.evaluation_snapshot?.vocabulary_feedback?.length" style="margin-top: 12px;">
            <strong>词汇订正：</strong>
            <ul style="margin: 6px 0 0; line-height: 1.7;">
              <li
                v-for="feedback in activeReviewItem.evaluation_snapshot.vocabulary_feedback"
                :key="feedback.dictionary_form"
              >
                辞书形：{{ feedback.dictionary_form }}<template v-if="feedback.meaning">（{{ feedback.meaning }}）</template>
              </li>
            </ul>
          </div>
          <div v-if="activeReviewItem.evaluation_snapshot?.acceptable_variants?.length" style="margin-top: 12px;">
            <strong>可接受变体：</strong>
            <ul style="margin: 6px 0 0; line-height: 1.7;">
              <li v-for="variant in activeReviewItem.evaluation_snapshot.acceptable_variants" :key="variant">
                {{ variant }}
              </li>
            </ul>
          </div>
          <div v-if="activeReviewItem.source_type === 'agent-study'" class="mistake-assessment-actions">
            <span>这次练习后：</span>
            <el-button plain :loading="isUpdatingStatus" @click="finishReviewItem('active')">
              仍需复习
            </el-button>
            <el-button type="success" :loading="isUpdatingStatus" @click="finishReviewItem('mastered')">
              已经掌握
            </el-button>
          </div>
        </el-card>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMainStore } from '@/store/mainStore'
import { createAgentStudyClient } from '@/utils/agentStudyClient'
import { toKanaInputWithSelection } from '@/utils/wanakanaInput'
import { useJapaneseSpeech } from '@/composables/useJapaneseSpeech'

const props = defineProps({
  client: {
    type: Object,
    default: null
  }
})

const store = useMainStore()
const client = computed(() => props.client || createAgentStudyClient())

const reviewDialogVisible = ref(false)
const activeReviewItem = ref(null)
const reviewAnswer = ref('')
const reviewSubmitted = ref(false)
const isSubmittingAttempt = ref(false)
const isUpdatingStatus = ref(false)
const isStartingSession = ref(false)
const agentMistakeBook = ref({ items: [] })
const progressReview = ref(null)
const mistakeSession = ref({ status: 'idle', size: 3, mistake_ids: [], current_index: 0, submitted_ids: [] })
const trainingSize = ref(3)
const bookView = ref('active')
const lessonFilter = ref('all')
const sourceFilter = ref('all')
const errorTagFilter = ref('all')
const dueFilter = ref('all')
const selectedAgentIds = ref([])
const isSessionReview = ref(false)
const speechRate = ref(0.85)
const { speak: speakJapanese } = useJapaneseSpeech()

const legacyItems = computed(() => store.mistakes_book || [])
const allAgentItems = computed(() =>
  (agentMistakeBook.value?.items || []).map((item) => {
    const evaluation = item.review_snapshot || null
    return {
    id: item.id,
    timestamp: item.created_at,
    mark_type: 'mistake',
    source_type: 'agent-study',
    source_types: item.source_types || ['automatic'],
    status: item.status,
    lesson: item.lesson,
    grammar_point: item.target_grammar,
    question_type: item.exercise_snapshot.type,
    original_question: item.exercise_snapshot.prompt,
    user_wrong_input: evaluation?.user_answer || '',
    correct_answer: evaluation?.correct_answer || item.exercise_snapshot.answer_reference || '',
    explanation: evaluation?.explanation || '这是一道手动加入的题目，请提交后对照参考答案复盘。',
    exercise_snapshot: item.exercise_snapshot,
    evaluation_snapshot: evaluation,
    attempts: item.attempts,
    last_practiced_at: item.last_practiced_at
    }
  })
)
const dueReviewQueueIds = computed(() => new Set(
  (progressReview.value?.reviewQueue?.items || [])
    .filter((item) => item.status === 'due')
    .map((item) => item.id)
))
const isDueMistake = (item) => dueReviewQueueIds.value.has(item.exercise_snapshot?.review_queue_id)
const lessonOptions = computed(() => [...new Set(allAgentItems.value.map((item) => item.lesson))].sort((a, b) => a - b))
const errorTagOptions = computed(() => [...new Set(
  allAgentItems.value.flatMap((item) => item.evaluation_snapshot?.error_tags || [])
)].sort())
const agentItems = computed(() => allAgentItems.value.filter((item) => {
  if (item.status !== bookView.value) return false
  if (lessonFilter.value !== 'all' && String(item.lesson) !== lessonFilter.value) return false
  if (sourceFilter.value !== 'all' && !item.source_types.includes(sourceFilter.value)) return false
  if (errorTagFilter.value !== 'all' && !item.evaluation_snapshot?.error_tags?.includes(errorTagFilter.value)) return false
  if (dueFilter.value === 'due' && !isDueMistake(item)) return false
  if (dueFilter.value === 'not_due' && isDueMistake(item)) return false
  return true
}))
const visibleLegacyItems = computed(() => legacyItems.value.filter((item) => {
  if (bookView.value !== 'active' || sourceFilter.value !== 'all') return false
  if (lessonFilter.value !== 'all' && String(item.lesson) !== lessonFilter.value) return false
  if (errorTagFilter.value !== 'all' || dueFilter.value === 'due') return false
  return true
}))
const tableData = computed(() => [
  ...agentItems.value,
  ...visibleLegacyItems.value
])
const reviewExercise = computed(() => activeReviewItem.value?.exercise_snapshot || null)
const reviewOptions = computed(() =>
  reviewExercise.value?.choices || reviewExercise.value?.options || []
)
const sessionProgressLabel = computed(() => {
  const total = mistakeSession.value?.mistake_ids?.length || 0
  if (!total) return '0/0'
  return `${Math.min((mistakeSession.value.current_index || 0) + 1, total)}/${total}`
})
const emptyTitle = computed(() => ({
  active: '当前没有待练错题',
  mastered: '还没有标记为已掌握的题目',
  dismissed: '没有已移出的题目'
})[bookView.value])
const emptyDescription = computed(() => bookView.value === 'active'
  ? '批改错误会自动收录，也可以在学习包或批改结果中手动加入。'
  : '切换到其他视图继续管理错题。'
)

const formatTime = (ts) => {
  if (!ts) return '未知时间'
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const normalizeAnswer = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()

const isExactReviewCorrect = computed(() => {
  if (!reviewSubmitted.value || !activeReviewItem.value) return false
  return normalizeAnswer(reviewAnswer.value) === normalizeAnswer(activeReviewItem.value.correct_answer)
})

const reviewResultType = computed(() => {
  if (!reviewSubmitted.value || !reviewExercise.value) return 'info'
  if (reviewExercise.value.type === 'q_fill') {
    return isExactReviewCorrect.value ? 'success' : 'error'
  }
  return isExactReviewCorrect.value ? 'success' : 'info'
})

const reviewResultText = computed(() => {
  if (!reviewSubmitted.value || !reviewExercise.value) return ''
  if (reviewExercise.value.type === 'q_fill') {
    return isExactReviewCorrect.value ? '这次答对了。' : '这次没有答对，下面可以直接对照答案复盘。'
  }
  return isExactReviewCorrect.value
    ? '你的答案和参考答案一致。'
    : '开放题已显示参考答案与解析，请重点比较表达方式和语法点。'
})

const openReview = (item, sessionReview = false) => {
  activeReviewItem.value = item
  reviewAnswer.value = ''
  reviewSubmitted.value = false
  isSessionReview.value = sessionReview
  reviewDialogVisible.value = true
}

const openCurrentSessionItem = () => {
  const mistakeId = mistakeSession.value?.mistake_ids?.[mistakeSession.value.current_index]
  const item = allAgentItems.value.find((candidate) => candidate.id === mistakeId)
  if (!item) {
    ElMessage.error('当前训练题目已经不可用，请结束后重新创建一组。')
    return
  }
  openReview(item, true)
}

const startTraining = async () => {
  if (typeof client.value.startMistakeDrillSession !== 'function') return
  isStartingSession.value = true
  try {
    mistakeSession.value = await client.value.startMistakeDrillSession({
      size: trainingSize.value,
      mistakeIds: selectedAgentIds.value
    })
    openCurrentSessionItem()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    isStartingSession.value = false
  }
}

const continueTraining = () => openCurrentSessionItem()

const endTraining = async () => {
  try {
    if (typeof client.value.endMistakeDrillSession === 'function') {
      mistakeSession.value = await client.value.endMistakeDrillSession()
    }
    reviewDialogVisible.value = false
    ElMessage.success('本次训练已结束，错题和作答记录都已保留。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const updateReviewAnswer = (value) => {
  const activeInput = document.activeElement
  const canRestoreSelection =
    activeInput instanceof HTMLInputElement || activeInput instanceof HTMLTextAreaElement
  const converted = toKanaInputWithSelection(
    value,
    canRestoreSelection ? activeInput.selectionStart : null,
    canRestoreSelection ? activeInput.selectionEnd : null
  )

  reviewAnswer.value = converted.value

  if (canRestoreSelection && converted.selectionStart !== null) {
    nextTick(() => {
      if (activeInput.isConnected && document.activeElement === activeInput) {
        activeInput.setSelectionRange(converted.selectionStart, converted.selectionEnd)
      }
    })
  }
}

const submitReview = async () => {
  if (!reviewAnswer.value.trim()) return

  if (activeReviewItem.value?.source_type !== 'agent-study') {
    reviewSubmitted.value = true
    return
  }

  isSubmittingAttempt.value = true
  try {
    const result = await client.value.submitMistakeAttempt({
      mistakeId: activeReviewItem.value.id,
      answer: reviewAnswer.value
    })
    agentMistakeBook.value = result.mistakeBook
    const refreshed = allAgentItems.value.find((item) => item.id === activeReviewItem.value.id)
    if (refreshed) activeReviewItem.value = refreshed
    reviewSubmitted.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    isSubmittingAttempt.value = false
  }
}

const removeMistake = (id) => {
  store.removeReviewItem(id)
  ElMessage.success('已删除这条记录。')
}

const dismissAgentMistake = async (id) => {
  try {
    const result = await client.value.dismissMistake({ mistakeId: id })
    agentMistakeBook.value = result.mistakeBook
    if (activeReviewItem.value?.id === id) reviewDialogVisible.value = false
    ElMessage.success('已移出错题本，可在“已移出”中恢复。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const restoreAgentMistake = async (id) => {
  try {
    const result = await client.value.setMistakeStatus({ mistakeId: id, status: 'active' })
    agentMistakeBook.value = result.mistakeBook
    ElMessage.success('已恢复到待练错题。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const handleSelectionChange = (rows) => {
  selectedAgentIds.value = (rows || [])
    .filter((row) => row.source_type === 'agent-study')
    .map((row) => row.id)
}

const updateSelectedStatus = async (status) => {
  if (!selectedAgentIds.value.length) return
  const result = await client.value.setMistakeStatus({
    mistakeIds: selectedAgentIds.value,
    status
  })
  agentMistakeBook.value = result.mistakeBook
  selectedAgentIds.value = []
}

const batchDismiss = async () => {
  try {
    await ElMessageBox.confirm(
      `将 ${selectedAgentIds.value.length} 道题移出错题本，之后仍可恢复。`,
      '批量移出',
      { confirmButtonText: '移出', cancelButtonText: '取消', type: 'warning' }
    )
    await updateSelectedStatus('dismissed')
    ElMessage.success('所选题目已移出错题本。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : String(error))
    }
  }
}

const batchRestore = async () => {
  try {
    await ElMessageBox.confirm(
      `将 ${selectedAgentIds.value.length} 道题恢复到待练错题。`,
      '批量恢复',
      { confirmButtonText: '恢复', cancelButtonText: '取消', type: 'info' }
    )
    await updateSelectedStatus('active')
    ElMessage.success('所选题目已恢复。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : String(error))
    }
  }
}

const finishReviewItem = async (status) => {
  if (!activeReviewItem.value || typeof client.value.setMistakeStatus !== 'function') return
  isUpdatingStatus.value = true
  try {
    const currentId = activeReviewItem.value.id
    const statusResult = await client.value.setMistakeStatus({ mistakeId: currentId, status })
    agentMistakeBook.value = statusResult.mistakeBook

    if (!isSessionReview.value || typeof client.value.advanceMistakeDrillSession !== 'function') {
      reviewDialogVisible.value = false
      ElMessage.success(status === 'mastered' ? '已标记为掌握。' : '已保留在待练错题中。')
      return
    }

    mistakeSession.value = await client.value.advanceMistakeDrillSession({ mistakeId: currentId })
    if (mistakeSession.value.status === 'completed') {
      reviewDialogVisible.value = false
      ElMessage.success('这一小组已经完成。')
    } else {
      openCurrentSessionItem()
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    isUpdatingStatus.value = false
  }
}

const clearAll = () => {
  ElMessageBox.confirm(
    '这会清空全部错题和收藏记录，且不可恢复。是否继续？',
    '确认清空',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      store.clearReviewItems()
      ElMessage.success('记录已清空。')
    })
    .catch(() => {})
}

const formatVocabHint = (hint) => {
  if (typeof hint === 'string') return hint
  return [hint?.word, hint?.kana, hint?.meaning || hint?.cn].filter(Boolean).join(' / ')
}

const sourceLabel = (row) => {
  if (row.source_type !== 'agent-study') return '旧记录'
  const sources = row.source_types || []
  if (sources.includes('manual') && sources.includes('automatic')) return '手动 + 自动'
  return sources.includes('manual') ? '手动加入' : '自动错题'
}

const loadAgentMistakes = async () => {
  try {
    const [loadedBook, loadedSession, loadedProgress] = await Promise.all([
      client.value.loadMistakes(),
      typeof client.value.loadMistakeDrillSession === 'function'
        ? client.value.loadMistakeDrillSession()
        : Promise.resolve(mistakeSession.value),
      typeof client.value.loadProgressReview === 'function'
        ? client.value.loadProgressReview()
        : Promise.resolve(null)
    ])
    agentMistakeBook.value = loadedBook
    mistakeSession.value = loadedSession
    progressReview.value = loadedProgress
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const playAudio = (text) => {
  let showedError = false
  const started = speakJapanese(text, {
    rate: speechRate.value,
    onError: () => {
      showedError = true
      ElMessage.error('当前浏览器不支持日语语音播放。')
    }
  })
  if (!started && !showedError) ElMessage.error('当前浏览器不支持语音播放。')
}

onMounted(loadAgentMistakes)
</script>

<style scoped>
.mistake-header,
.mistake-header-actions,
.mistake-toolbar,
.mistake-assessment-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.mistake-mobile-list {
  display: none;
}

.mistake-header {
  justify-content: space-between;
}

.mistake-title {
  color: #f56c6c;
  font-size: 1.1rem;
  font-weight: 700;
}

.mistake-subtitle {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.mistake-toolbar {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.mistake-toolbar label {
  display: grid;
  gap: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mistake-select {
  min-width: 112px;
  min-height: 36px;
  padding: 0 10px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.mistake-total {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.mistake-assessment-actions {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-light);
}

@media (max-width: 720px) {
  .mistake-header,
  .mistake-toolbar {
    align-items: stretch;
  }

  .mistake-header-actions,
  .mistake-total {
    margin-left: 0;
  }

  .mistake-desktop-table {
    display: none;
  }

  .mistake-mobile-list {
    display: grid;
    gap: 10px;
  }

  .mistake-mobile-item {
    display: grid;
    gap: 10px;
    padding: 14px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .mistake-mobile-meta,
  .mistake-mobile-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mistake-mobile-meta span,
  .mistake-mobile-grammar {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
