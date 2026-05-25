<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">听力关键词捕捉</div>
      </template>
      <div style="display: grid; gap: 10px; max-width: 620px;">
        <div>请听句子并写出关键词（任意顺序，用空格分隔）。</div>
        <el-tag type="info">课次：第 {{ targetLesson }} 课</el-tag>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <el-button type="primary" @click="playAudio">播放</el-button>
          <el-button plain @click="playAudio">重播</el-button>
          <el-button plain @click="nextSample">换一题</el-button>
        </div>
        <el-input v-model="userKeywords" placeholder="例如：银行 现在 工作" />
        <div style="display: flex; gap: 8px;">
          <el-button type="success" @click="submit">提交</el-button>
          <el-tag :type="completed ? 'success' : 'info'">{{ completed ? '已完成本题' : '未完成' }}</el-tag>
        </div>
      </div>
    </el-card>

    <el-card v-if="result" shadow="never">
      <div style="display: grid; gap: 6px;">
        <el-tag :type="result.correct ? 'success' : 'warning'">{{ result.correct ? '关键词匹配通过' : '关键词不足' }}</el-tag>
        <div>参考关键词：{{ result.expected.join(' / ') }}</div>
        <div>你的关键词：{{ result.actual.join(' / ') || '(空)' }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useMainStore } from '@/store/mainStore'

const store = useMainStore()
const targetLesson = store.progress.current_lesson

const samples = [
  { text: 'わたしは いま ぎんこうで しごとしています。', keywords: ['ぎんこう', 'しごと'] },
  { text: 'きょうは かいぎの まえに しりょうを よみます。', keywords: ['かいぎ', 'しりょう'] },
  { text: 'あしたの あさ くうこうへ いきます。', keywords: ['あした', 'くうこう'] }
]

const index = ref(0)
const userKeywords = ref('')
const completed = ref(false)
const result = ref(null)

const currentSample = () => samples[index.value % samples.length]

const playAudio = () => {
  if (!('speechSynthesis' in window)) {
    ElMessage.error('当前浏览器不支持语音播放。')
    return
  }
  const utter = new SpeechSynthesisUtterance(currentSample().text)
  utter.lang = 'ja-JP'
  utter.rate = 0.9
  window.speechSynthesis.speak(utter)
}

const normalize = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

const submit = () => {
  const expected = currentSample().keywords
  const actual = normalize(userKeywords.value)
  const hit = expected.filter((item) => actual.includes(item))
  const correct = hit.length >= Math.max(1, expected.length - 1)

  store.recordListeningPracticeResult({
    lesson: targetLesson,
    isCorrect: correct
  })

  completed.value = true
  result.value = { expected, actual, correct }
  if (correct) {
    ElMessage.success('关键词捕捉通过。')
  } else {
    ElMessage.warning('已记录结果，建议重播后再试。')
  }
}

const nextSample = () => {
  index.value += 1
  userKeywords.value = ''
  completed.value = false
  result.value = null
}
</script>
