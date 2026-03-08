<template>
  <div>
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

            <el-form-item label="题型完成雷达：">
               <div style="display: flex; gap: 10px;">
                   <el-tag :type="getTypeCompletion('q_fill') ? 'success' : 'info'" effect="dark">
                      {{ getTypeCompletion('q_fill') ? `✅ 语感填空 (${getTypeCompletion('q_fill')})` : '⏳ 语感填空 待通关' }}
                   </el-tag>
                   <el-tag :type="getTypeCompletion('q_translate') ? 'success' : 'info'" effect="dark">
                      {{ getTypeCompletion('q_translate') ? `✅ 翻译造句 (${getTypeCompletion('q_translate')})` : '⏳ 翻译造句 待通关' }}
                   </el-tag>
                   <el-tag :type="getTypeCompletion('q_conversation') ? 'success' : 'info'" effect="dark">
                      {{ getTypeCompletion('q_conversation') ? `✅ 职场情景 (${getTypeCompletion('q_conversation')})` : '⏳ 职场情景 待通关' }}
                   </el-tag>
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/store/mainStore'
import syllabusDict from '@/data/syllabus.json'

const store = useMainStore()
const router = useRouter()
const syllabus = ref(syllabusDict)

const config = ref({
    targetLesson: store.progress.current_lesson,
    questionCount: 5,
    difficulty: '基础巩固',
    customPrompt: '',
    questionType: 'ALL'
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

const appendTag = (tag) => {
    if (config.value.customPrompt.includes(tag)) return;
    config.value.customPrompt += config.value.customPrompt ? `，并且包含【${tag}】场景` : `设定为【${tag}】场景`;
}

const onStart = () => {
    // Navigate via router, passing the complex config object as a JSON string in query/state
    router.push({
        path: '/training',
        query: {
            sessionConfig: JSON.stringify(config.value)
        }
    })
}
</script>
