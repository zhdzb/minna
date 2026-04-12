<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="font-size: 1.1rem; font-weight: bold; color: #f56c6c;">
            错题与收藏
          </div>
          <el-button type="danger" plain @click="clearAll" :disabled="tableData.length === 0">
            清空全部
          </el-button>
        </div>
      </template>

      <el-alert
        v-if="tableData.length === 0"
        title="还没有错题或收藏"
        type="success"
        description="做完训练后，你保存的题目会出现在这里。"
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

        <el-table-column label="标签" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.mark_type === 'favorite' ? 'success' : 'danger'">
              {{ row.mark_type === 'favorite' ? '收藏' : '错题' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="question_type" label="题型" width="130" />
        <el-table-column prop="grammar_point" label="语法点" min-width="180" show-overflow-tooltip />
        <el-table-column prop="original_question" label="题目" min-width="220" show-overflow-tooltip />

        <el-table-column label="操作" width="180">
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
              <el-button size="small" type="danger" plain @click="removeMistake(row.id)">
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
          {{ reviewExercise.question || reviewExercise.chinese_prompt || reviewExercise.scene_description }}
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
              :key="`${hint.word}-${index}`"
              style="padding: 8px 10px; border-radius: 8px; background: #f5f7fa; border: 1px solid #ebeef5;"
            >
              <div style="font-size: 0.75rem; color: #909399;">{{ hint.kana }}</div>
              <div style="font-weight: 600;">{{ hint.word }}</div>
              <div style="font-size: 0.8rem; color: #606266;">{{ hint.cn }}</div>
            </div>
          </div>
        </div>

        <div v-if="reviewExercise.type === 'q_fill'" style="margin-bottom: 16px;">
          <el-radio-group v-model="reviewAnswer">
            <el-radio-button
              v-for="option in reviewExercise.options"
              :key="option"
              :label="option"
            />
          </el-radio-group>
        </div>

        <div v-else style="margin-bottom: 16px;">
          <el-input
            v-model="reviewAnswer"
            type="textarea"
            :rows="4"
            placeholder="在这里重新作答"
          />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-size: 0.85rem; color: #909399;">
            开放题会显示参考答案和解析，主要用于复盘，不做严格自动判卷。
          </div>
          <div style="display: flex; gap: 8px;">
            <el-button @click="reviewDialogVisible = false">关闭</el-button>
            <el-button type="primary" @click="submitReview">
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
        </el-card>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMainStore } from '@/store/mainStore'

const store = useMainStore()

const reviewDialogVisible = ref(false)
const activeReviewItem = ref(null)
const reviewAnswer = ref('')
const reviewSubmitted = ref(false)

const tableData = computed(() => store.mistakes_book)
const reviewExercise = computed(() => activeReviewItem.value?.exercise_snapshot || null)

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

const submitReview = () => {
  reviewSubmitted.value = true
}

const removeMistake = (id) => {
  store.removeReviewItem(id)
  ElMessage.success('已删除这条记录。')
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

const playAudio = (text) => {
  if (!('speechSynthesis' in window)) {
    ElMessage.error('当前浏览器不支持语音播放。')
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}
</script>
