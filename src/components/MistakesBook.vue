<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="font-size: 1.1rem; font-weight: bold; color: #f56c6c;">
            错题训练
          </div>
          <el-button type="danger" plain @click="clearAll" :disabled="legacyItems.length === 0">
            清空旧记录
          </el-button>
        </div>
      </template>

      <el-alert
        v-if="tableData.length === 0"
        title="还没有错题"
        type="success"
        description="批改完成后，系统会自动把 is_correct 为 false 的题目放到这里。"
        show-icon
        :closable="false"
      />

      <el-table
        v-else
        :data="tableData"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'timestamp', order: 'descending' }"
      >
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
              {{ row.source_type === 'agent-study' ? '自动错题' : '旧记录' }}
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

        <el-table-column label="操作" width="190">
          <template #default="{ row }">
            <div style="display: flex; gap: 8px;">
              <el-button
                size="small"
                type="primary"
                plain
                @click="openReview(row)"
                :disabled="!row.exercise_snapshot"
              >
                重新做
              </el-button>
              <el-button
                v-if="row.source_type === 'agent-study'"
                size="small"
                type="danger"
                plain
                @click="dismissAgentMistake(row.id)"
              >
                删除
              </el-button>
              <el-button
                v-else
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
    </el-card>

    <el-dialog
      v-model="reviewDialogVisible"
      title="题目复习"
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
            <el-button @click="reviewDialogVisible = false">关闭</el-button>
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
const agentMistakeBook = ref({ items: [] })
const speechRate = ref(0.85)
const { speak: speakJapanese } = useJapaneseSpeech()

const legacyItems = computed(() => store.mistakes_book || [])
const agentItems = computed(() =>
  (agentMistakeBook.value?.items || []).filter((item) => item.status !== 'dismissed').map((item) => ({
    id: item.id,
    timestamp: item.created_at,
    mark_type: 'mistake',
    source_type: 'agent-study',
    lesson: item.lesson,
    grammar_point: item.target_grammar,
    question_type: item.exercise_snapshot.type,
    original_question: item.exercise_snapshot.prompt,
    user_wrong_input: item.review_snapshot.user_answer,
    correct_answer: item.review_snapshot.correct_answer,
    explanation: item.review_snapshot.explanation,
    exercise_snapshot: item.exercise_snapshot,
    evaluation_snapshot: item.review_snapshot,
    attempts: item.attempts,
    last_practiced_at: item.last_practiced_at
  }))
)
const tableData = computed(() => [...agentItems.value, ...legacyItems.value])
const reviewExercise = computed(() => activeReviewItem.value?.exercise_snapshot || null)
const reviewOptions = computed(() =>
  reviewExercise.value?.choices || reviewExercise.value?.options || []
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

const openReview = (item) => {
  activeReviewItem.value = item
  reviewAnswer.value = ''
  reviewSubmitted.value = false
  reviewDialogVisible.value = true
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
    const refreshed = agentItems.value.find((item) => item.id === activeReviewItem.value.id)
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
    ElMessage.success('已从错题训练中删除。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
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

const loadAgentMistakes = async () => {
  try {
    agentMistakeBook.value = await client.value.loadMistakes()
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
