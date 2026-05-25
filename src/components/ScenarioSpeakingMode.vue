<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">场景口语训练</div>
      </template>
      <div style="display: grid; gap: 10px; max-width: 760px;">
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <el-tag type="info">课次：第 {{ targetLesson }} 课</el-tag>
          <el-tag>语法范围：{{ grammarSummary }}</el-tag>
        </div>
        <div style="display: flex; gap: 8px;">
          <el-button type="primary" :loading="isGenerating" @click="generateScenario">生成场景题</el-button>
        </div>
      </div>
    </el-card>

    <el-card v-if="exercise" shadow="hover" style="margin-bottom: 16px;">
      <div style="display: grid; gap: 10px;">
        <el-tag type="warning">场景对话补全</el-tag>
        <div style="font-size: 16px;">{{ exercise.scene_description }}</div>
        <div style="background: #f9fafc; border: 1px solid #ebeef5; border-radius: 8px; padding: 12px;">
          <div v-for="(turn, idx) in exercise.turns" :key="idx" style="margin-bottom: 6px;">
            <strong>{{ turn.speaker }}:</strong>
            <span v-if="idx !== exercise.missing_turn_index">{{ turn.content }}</span>
            <span v-else style="color: #409eff;">（请补全这一句）</span>
          </div>
        </div>
        <el-input v-model="userAnswer" placeholder="输入你的口语回答" />
        <div style="display: flex; gap: 8px;">
          <el-button type="success" :loading="isEvaluating" @click="evaluateAnswer">提交批改</el-button>
        </div>
      </div>
    </el-card>

    <el-card v-if="evaluation" shadow="never">
      <div style="display: grid; gap: 8px;">
        <el-tag :type="evaluation.is_correct ? 'success' : 'danger'">
          {{ evaluation.is_correct ? '表达通过' : '需要改进' }}
        </el-tag>
        <div><strong>你的回答：</strong>{{ userAnswer || '(空)' }}</div>
        <div><strong>参考回答：</strong>{{ evaluation.correct_answer }}</div>
        <div><strong>批改说明：</strong>{{ evaluation.explanation }}</div>
        <div style="display: flex; gap: 8px;">
          <el-button type="warning" plain size="small" @click="saveReviewItem('mistake')">加入错题本</el-button>
          <el-button type="success" plain size="small" @click="saveReviewItem('favorite')">收藏本题</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useMainStore } from '@/store/mainStore'
import syllabusDict from '@/data/syllabus.json'

const store = useMainStore()
const targetLesson = store.progress.current_lesson

const lesson = syllabusDict.lessons.find((item) => item.id === targetLesson) || syllabusDict.lessons[0]
const grammarPoints = lesson?.grammar_points?.slice(0, 5) || []
const grammarSummary = computed(() => grammarPoints.join(' / '))

const isGenerating = ref(false)
const isEvaluating = ref(false)
const exercise = ref(null)
const userAnswer = ref('')
const evaluation = ref(null)

const generateScenario = async () => {
  isGenerating.value = true
  evaluation.value = null
  userAnswer.value = ''
  try {
    const response = await fetch('/api/ai/exercise-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson: targetLesson,
        grammar_points: grammarPoints,
        hidden_knowledge: lesson?.hidden_knowledge || [],
        recent_exercises: [],
        config: {
          questionType: 'q_conversation',
          questionCount: 1,
          difficulty: '职场进阶',
          customPrompt: '请优先使用日本工作场景'
        }
      })
    })

    if (!response.ok) {
      throw new Error(`生成失败：${response.status}`)
    }

    const payload = await response.json()
    exercise.value = payload?.data?.exercises?.[0] || null
    if (!exercise.value) {
      throw new Error('未获得可用场景题。')
    }
    ElMessage.success('已生成场景口语题。')
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    isGenerating.value = false
  }
}

const evaluateAnswer = async () => {
  if (!exercise.value) return
  isEvaluating.value = true
  try {
    const response = await fetch('/api/ai/exercise-evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_lesson: targetLesson,
        batch: [
          {
            id: exercise.value.id,
            type: exercise.value.type,
            original_prompt: exercise.value.scene_description,
            user_answer: userAnswer.value || '',
            reference_answer: exercise.value.answer || ''
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`批改失败：${response.status}`)
    }

    const payload = await response.json()
    evaluation.value = payload?.data?.[0] || null
    if (!evaluation.value) {
      throw new Error('未获得批改结果。')
    }
    ElMessage.success('批改完成。')
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    isEvaluating.value = false
  }
}

const saveReviewItem = (markType) => {
  if (!exercise.value || !evaluation.value) return
  store.addReviewItem(
    {
      lesson: targetLesson,
      grammar_point: exercise.value.target_grammar || '',
      question_type: exercise.value.type,
      original_question: exercise.value.scene_description,
      user_wrong_input: userAnswer.value,
      correct_answer: evaluation.value.correct_answer || exercise.value.answer || '',
      explanation: evaluation.value.explanation || '',
      exercise_snapshot: {
        ...exercise.value
      },
      evaluation_snapshot: {
        ...evaluation.value
      }
    },
    markType
  )
  ElMessage.success(markType === 'favorite' ? '已收藏本题。' : '已加入错题本。')
}
</script>
