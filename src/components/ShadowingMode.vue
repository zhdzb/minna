<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 700;">Shadowing 训练</div>
      </template>
      <div style="display: grid; gap: 10px; max-width: 700px;">
        <el-tag type="info">课次：第 {{ targetLesson }} 课</el-tag>
        <div style="font-size: 18px; line-height: 1.6;">{{ sentence }}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <el-button type="primary" @click="playSentence">播放示范</el-button>
          <el-button plain @click="playSentence">重播</el-button>
          <el-button plain @click="nextSentence">换一句</el-button>
        </div>
        <div>
          <div style="font-size: 13px; color: #666; margin-bottom: 6px;">跟读后给自己打分（1~5）</div>
          <el-rate v-model="rating" :max="5" />
        </div>
        <div style="display: flex; gap: 8px;">
          <el-button type="success" @click="submitRating">提交评分</el-button>
          <el-tag :type="completed ? 'success' : 'info'">{{ completed ? '已完成本题' : '未完成' }}</el-tag>
        </div>
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

const sentences = [
  'おはようございます。きょうも よろしく おねがいします。',
  'この しりょうは かいぎの まえに かくにんしてください。',
  'らいしゅうの よていを もういちど きょうゆうします。'
]

const index = ref(0)
const rating = ref(3)
const completed = ref(false)

const sentence = ref(sentences[0])

const playSentence = () => {
  if (!('speechSynthesis' in window)) {
    ElMessage.error('当前浏览器不支持语音播放。')
    return
  }
  const utter = new SpeechSynthesisUtterance(sentence.value)
  utter.lang = 'ja-JP'
  utter.rate = 0.88
  window.speechSynthesis.speak(utter)
}

const nextSentence = () => {
  index.value += 1
  sentence.value = sentences[index.value % sentences.length]
  rating.value = 3
  completed.value = false
}

const submitRating = () => {
  store.recordShadowingPracticeResult({
    lesson: targetLesson,
    rating: rating.value
  })
  completed.value = true
  ElMessage.success('已记录 shadowing 评分。')
}
</script>
