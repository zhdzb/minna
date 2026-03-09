<template>
  <div>
    <el-alert 
        v-if="tStore.exercises.length > 0 && tStore.currentPhase === 'answering'" 
        type="warning" 
        show-icon 
        style="margin-bottom: 20px;">
        <template #title>
            您有一个未完成的集训正在进行中！
            <el-button size="small" type="primary" style="margin-left: 15px;" @click="onResume">继续集训</el-button>
        </template>
    </el-alert>

    <el-card shadow="hover" style="margin-bottom: 20px;">
      <template #header>
        <div style="font-size: 1.2rem; font-weight: bold; color: #409EFF;">
          🏆 准备好开始今天的集训了吗？
        </div>
      </template>
      <div style="display: flex; align-items: center; justify-content: space-between;">
          <p style="font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
             目标集训课时：
             <el-select v-model="config.targetLesson" style="width: 150px;" size="large">
                <el-option v-for="l in syllabus.lessons" :key="l.id" :label="l.title" :value="l.id" />
             </el-select>
             <span style="font-size: 0.85rem; color: #888; margin-left: 5px;">
                (当前推荐锚点: 第 {{ store.progress.current_lesson }} 课)
             </span>
          </p>
          <el-button type="primary" plain @click="$router.push('/syllabus')">去大纲调整知识图云</el-button>
      </div>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 20px;">
      <template #header>
        <div style="font-weight: bold;">📈 课内进度可视化</div>
      </template>
      <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
        <div style="min-width: 180px; text-align: center;">
          <el-progress type="circle" :percentage="lessonCompletionPercent" :stroke-width="10" />
          <div style="margin-top: 10px; color: #666;">第 {{ config.targetLesson }} 课题型完成度</div>
        </div>
        <div style="flex: 1; min-width: 260px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
            <el-tag 
              v-for="type in enabledTypes"
              :key="type"
              :type="getTypeCompletion(type) ? 'success' : 'info'"
              effect="dark"
            >
              {{ typeLabels[type] || type }}
            </el-tag>
          </div>
          <div style="font-size: 0.9rem; color: #888;">
            上次练习：{{ lastSessionText }}
          </div>
        </div>
      </div>
    </el-card>

    <!-- Phase 3: Element Plus Form -->
    <el-card shadow="hover" style="margin-top: 20px;">
        <template #header>
            <div style="font-weight: bold;">🕹️ AI 动态出题控制台</div>
        </template>
        
        <el-form label-width="140px" :model="config" size="large">
            
            <el-form-item label="生成题量控制：">
                <el-slider v-model="config.questionCount" :min="1" :max="20" show-input style="width: 80%;" />
                <span style="margin-left: 15px; color: #888;">道题目</span>
            </el-form-item>

            <el-form-item label="难度梯度：">
                <el-radio-group v-model="config.difficulty">
                    <el-radio-button label="基础巩固" />
                    <el-radio-button label="职场进阶" />
                    <el-radio-button label="JLPT真题级" />
                </el-radio-group>
            </el-form-item>
            <el-form-item label="专项题型挑选：">
                <el-select v-model="config.questionType" placeholder="请选择题型" style="width: 300px;">
                    <el-option label="🎲 混合实战考核 (All)" value="ALL" />
                    <el-option label="📝 专项：基础语感填空" value="q_fill" />
                    <el-option label="🗣️ 专项：日汉翻译造句突破" value="q_translate" />
                    <el-option label="🏢 专项：职场情景对话补全" value="q_conversation" />
                </el-select>
            </el-form-item>

            <el-form-item label="通关正确率门槛：">
                <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <el-slider v-model="passThreshold" :min="0.3" :max="1" :step="0.05" style="flex: 1;" />
                    <el-tag type="warning">{{ Math.round(passThreshold * 100) }}%</el-tag>
                </div>
            </el-form-item>

            <el-form-item label="题型完成雷达：">
               <div style="display: flex; gap: 10px;">
                   <el-tooltip content="点击即可手动点亮/熄灭此项印记" placement="top">
                       <el-tag 
                           :type="getTypeCompletion('q_fill') ? 'success' : 'info'" 
                           effect="dark" 
                           style="cursor: pointer; transition: all 0.2s;"
                           @click="store.toggleTypeCompletion(config.targetLesson, 'q_fill')"
                       >
                          {{ getTypeCompletion('q_fill') ? `✅ 语感填空 (${getTypeCompletion('q_fill')})` : '⏳ 语感填空 (点击空降通关)' }}
                       </el-tag>
                   </el-tooltip>
                   
                   <el-tooltip content="点击即可手动点亮/熄灭此项印记" placement="top">
                       <el-tag 
                           :type="getTypeCompletion('q_translate') ? 'success' : 'info'" 
                           effect="dark"
                           style="cursor: pointer; transition: all 0.2s;"
                           @click="store.toggleTypeCompletion(config.targetLesson, 'q_translate')"
                       >
                          {{ getTypeCompletion('q_translate') ? `✅ 翻译造句 (${getTypeCompletion('q_translate')})` : '⏳ 翻译造句 (点击空降通关)' }}
                       </el-tag>
                   </el-tooltip>
                   
                   <el-tooltip content="点击即可手动点亮/熄灭此项印记" placement="top">
                       <el-tag 
                           :type="getTypeCompletion('q_conversation') ? 'success' : 'info'" 
                           effect="dark"
                           style="cursor: pointer; transition: all 0.2s;"
                           @click="store.toggleTypeCompletion(config.targetLesson, 'q_conversation')"
                       >
                          {{ getTypeCompletion('q_conversation') ? `✅ 职场情景 (${getTypeCompletion('q_conversation')})` : '⏳ 职场情景 (点击空降通关)' }}
                       </el-tag>
                   </el-tooltip>
               </div>
            </el-form-item>

            <el-form-item label="定制化要求 (Prompt)：">
                <el-input 
                    v-model="config.customPrompt" 
                    placeholder="可选，例如：我是程序员，多出电脑工作与加班相关的词汇造句..." 
                    clearable
                />
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <span style="font-size: 0.85rem; color: #888;">快捷注入标签:</span>
                    <el-tag size="small" style="cursor: pointer;" @click="appendTag('职场商务Keigo')">💼 职场商务 (Keigo)</el-tag>
                    <el-tag size="small" style="cursor: pointer;" @click="appendTag('IT与程序员日常')">💻 IT与程序员日常</el-tag>
                    <el-tag size="small" style="cursor: pointer;" @click="appendTag('旅行与点餐')">🍱 旅行与生存点餐</el-tag>
                    <el-tag size="small" style="cursor: pointer;" type="danger" @click="appendTag('地道关西腔体验')">🐙 地道关西腔体验</el-tag>
                </div>
            </el-form-item>

            <el-form-item>
                <el-button type="primary" size="large" @click="onStart" style="width: 200px; font-weight: bold;" icon="el-icon-video-play">
                    🚀 发起 AI 训练请求
                </el-button>
            </el-form-item>
            
        </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/store/mainStore'
import { useTrainingStore } from '@/store/trainingStore'
import syllabusDict from '@/data/syllabus.json'

const store = useMainStore()
const tStore = useTrainingStore()
const router = useRouter()
const syllabus = ref(syllabusDict)

const config = ref({
    targetLesson: store.progress.current_lesson,
    questionCount: 5,
    difficulty: '基础巩固',
    customPrompt: '',
    questionType: 'ALL'
})

watch(() => store.progress.current_lesson, (newVal) => {
    config.value.targetLesson = newVal;
})

const getTypeCompletion = (type) => {
    const lessonId = config.value.targetLesson
    const completedData = store.progress.completed_types_by_lesson[lessonId]
    if (!completedData) return false;
    
    if (Array.isArray(completedData)) {
        return completedData.includes(type) ? '基础巩固' : false;
    }
    
    return completedData[type] || false;
}

const passThreshold = computed({
    get() {
        return store.progress.pass_threshold || 0.5
    },
    set(val) {
        store.setPassThreshold(val)
    }
})

const enabledTypes = computed(() => {
    const lesson = syllabus.value.lessons.find(l => l.id === config.value.targetLesson)
    return lesson?.enabled_question_types || []
})

const typeLabels = {
    q_fill: '语感填空',
    q_translate: '翻译造句',
    q_conversation: '职场情景'
}

const lessonCompletionPercent = computed(() => {
    const total = enabledTypes.value.length
    if (!total) return 0
    const completed = enabledTypes.value.filter(t => !!getTypeCompletion(t)).length
    return Math.round((completed / total) * 100)
})

const lastSessionText = computed(() => {
    const stats = store.progress.lesson_stats?.[config.value.targetLesson]
    if (!stats || !stats.last_session_at) return '暂无记录'
    const rate = Math.round((stats.last_correct_rate || 0) * 100)
    return `${rate}% 正确率 / ${stats.last_correct_count || 0} 正确 / ${stats.last_question_count || 0} 题`
})

const appendTag = (tag) => {
    if (config.value.customPrompt.includes(tag)) return;
    config.value.customPrompt += config.value.customPrompt ? `，并且包含【${tag}】场景` : `设定为【${tag}】场景`;
}

const onStart = () => {
    // Navigate via router, passing the complex config object as a JSON string in query/state
    router.push({
        path: '/training',
        query: {
            sessionConfig: JSON.stringify(config.value),
            t: Date.now()
        }
    })
}

const onResume = () => {
    router.push({
        path: '/training',
        query: {
            sessionConfig: JSON.stringify(tStore.currentConfig),
            t: tStore.sessionTimestamp
        }
    })
}
</script>
