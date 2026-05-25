<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">句型替换训练</div>
      </template>
      <div style="color: #666; margin-bottom: 8px;">
        用固定句型做替换练习，先从可控输出开始，逐步过渡到自由造句。
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <span>课次</span>
        <el-input-number v-model="targetLesson" :min="1" :max="lessonMax" />
        <el-button @click="loadLesson">载入句型</el-button>
      </div>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">题目</div>
      </template>
      <div style="margin-bottom: 8px;">
        <el-tag type="info">{{ selectedPattern }}</el-tag>
      </div>
      <div style="font-size: 16px; margin-bottom: 12px;">{{ promptText }}</div>
      <div style="display: grid; gap: 10px; max-width: 520px;">
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">替换槽 A（主语）</div>
          <el-select v-model="slotA" style="width: 100%;">
            <el-option v-for="item in slotAOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">替换槽 B（动作）</div>
          <el-select v-model="slotB" style="width: 100%;">
            <el-option v-for="item in slotBOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">输入你的完整句子</div>
          <el-input v-model="userSentence" placeholder="例如：わたしは いま べんきょうしています。" />
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <el-button type="primary" @click="submitAnswer">提交</el-button>
        <el-button plain @click="nextQuestion">下一题</el-button>
      </div>
    </el-card>

    <el-card v-if="result" shadow="never">
      <div style="display: grid; gap: 6px;">
        <el-tag :type="result.correct ? 'success' : 'warning'">{{ result.correct ? '正确' : '需要调整' }}</el-tag>
        <div>标准答案：{{ result.expected }}</div>
        <div>你的答案：{{ result.actual || '(空)' }}</div>
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

const lessonMax = syllabusDict.lessons.length || 50
const targetLesson = ref(store.progress.current_lesson || 1)
const selectedPattern = ref('')
const slotA = ref('わたし')
const slotB = ref('べんきょうします')
const userSentence = ref('')
const result = ref(null)

const slotAOptions = ['わたし', 'わたしたち', 'せんせい', 'ともだち']
const slotBOptions = ['べんきょうします', 'れんしゅうします', 'しごとします', 'はなします']

const patternTemplate = computed(() => `${slotA.value}は いま ${slotB.value}。`)
const promptText = computed(() => `请按句型改写并输出完整句子：${patternTemplate.value}`)

const loadLesson = () => {
  const lesson = syllabusDict.lessons.find((item) => item.id === Number(targetLesson.value))
  const fallback = `Lesson ${targetLesson.value}`
  selectedPattern.value = lesson?.grammar_points?.[0] || fallback
  result.value = null
  userSentence.value = ''
}

const normalizeSentence = (value) => String(value || '').replace(/\s+/g, '')

const submitAnswer = () => {
  const expected = `${slotA.value}はいま${slotB.value}。`
  const actual = userSentence.value
  const correct = normalizeSentence(actual) === normalizeSentence(expected)

  store.recordPatternSubstitutionResult({
    lesson: Number(targetLesson.value),
    pattern: selectedPattern.value || `lesson_${targetLesson.value}_pattern_substitution`,
    isCorrect: correct
  })

  result.value = { expected, actual, correct }
  if (correct) {
    ElMessage.success('很好，句型替换正确。')
  } else {
    ElMessage.warning('已记录训练结果，建议再试一次。')
  }
}

const nextQuestion = () => {
  const aIndex = slotAOptions.indexOf(slotA.value)
  const bIndex = slotBOptions.indexOf(slotB.value)
  slotA.value = slotAOptions[(aIndex + 1) % slotAOptions.length]
  slotB.value = slotBOptions[(bIndex + 1) % slotBOptions.length]
  userSentence.value = ''
  result.value = null
}

loadLesson()
</script>
