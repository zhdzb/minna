<template>
  <div v-loading.fullscreen.lock="tStore.isGenerating" element-loading-text="AI 私教正在根据大纲为您定制生成题目...">
    
    <div v-if="tStore.generationError" style="color: red; padding: 20px;">
        <h3>出题失败</h3>
        <p>{{ tStore.generationError }}</p>
        <el-button @click="$router.push('/')">返回控制台</el-button>
    </div>

    <el-container v-if="tStore.exercises.length > 0 && !tStore.isGenerating" style="height: 80vh;">
      
      <!-- 主做题区 -->
      <el-main style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);">
         
         <!-- 答题阶段 -->
         <div v-if="tStore.currentPhase === 'answering'">
            <div style="font-size: 1.2rem; margin-bottom: 20px; color: #409EFF;">
               <i class="el-icon-edit-outline"></i> 正在挑战: {{ tStore.config?.difficulty }} ( 第 {{ tStore.config?.targetLesson || store.progress.current_lesson }} 课 )
            </div>

            <!-- 当前选中的题目卡片 -->
            <transition name="el-fade-in" mode="out-in">
                <el-card v-if="currentExercise" :key="currentExercise.id" style="min-height: 250px;">
                    <div style="margin-bottom: 15px;">
                        <el-tag effect="dark" :type="currentExercise.type.includes('translate') ? 'warning' : 'primary'">
                            {{ currentExercise.type }}
                        </el-tag>
                    </div>
                    
                    <h3 style="margin-bottom: 20px; line-height: 1.5;">
                        {{ currentExercise.question || currentExercise.chinese_prompt }}
                    </h3>

                    <!-- 词汇提示 (Hover 浮现模糊版) -->
                    <div v-if="currentExercise.vocab_hints" style="margin-bottom: 20px;">
                        <p style="font-size: 0.8rem; color: #888;">Hover 查看单词提示 👇</p>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div v-for="(hint, idx) in currentExercise.vocab_hints" :key="idx" class="blur-hint-card">
                                <span class="cn">{{ hint.cn }}</span>
                                <span class="revealer">
                                    <span class="kana">{{ hint.kana }}</span>
                                    <span class="kanji">{{ hint.word }}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 用户输入区域 -->
                    <div v-if="currentExercise.type === 'q_fill'" style="display: flex; gap: 10px;">
                         <el-radio-group v-model="tStore.userAnswers[currentExercise.id]">
                            <el-radio-button v-for="opt in currentExercise.options" :key="opt" :label="opt" />
                         </el-radio-group>
                    </div>
                    <div v-else>
                         <p style="font-size: 0.8rem; color: #888; margin-bottom: 5px;">
                          🚀 在此输入即可自动转假名。(片假名请大写锁定输入)
                         </p>
                         <el-input 
                            v-model="tStore.userAnswers[currentExercise.id]"
                            :ref="(el) => bindWanaKana(el, currentExercise.id)"
                            placeholder="Type in romaji..."
                            size="large"
                            clearable
                         />
                    </div>
                </el-card>
            </transition>
         </div>

         <!-- 批改结果阶段 -->
         <div v-if="tStore.currentPhase === 'results'" v-loading="tStore.isEvaluating" element-loading-text="AI 严师正在逐句批阅你的答案...">
            <h2>📝 批改报告</h2>
            <div style="margin-top: 20px;">
                <el-card 
                    v-for="res in tStore.evaluations" 
                    :key="res.id"
                    style="margin-bottom: 15px;"
                    :body-style="res.is_correct ? { borderLeft: '5px solid #67C23A' } : { borderLeft: '5px solid #F56C6C' }"
                >
                    <div style="font-weight: bold; margin-bottom: 10px;">{{ res.original_question }}</div>
                    <div style="color: #666; margin-bottom: 5px;">你的答案: {{ res.user_answer || '(未填写)' }}</div>
                    <div style="color: #409EFF; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        正解参考: {{ res.correct_answer }}
                        <el-button 
                           v-if="res.type !== 'q_fill'" 
                           size="small" 
                           circle 
                           icon="el-icon-headset" 
                           @click="playAudio(res.correct_answer)"
                           title="播放日语发音"
                        >
                           🔊
                        </el-button>
                    </div>
                    
                    <el-alert
                        :type="res.is_correct ? 'success' : 'error'"
                        :closable="false"
                        style="margin-top: 10px;"
                    >
                        <template #title>
                            <div v-html="res.explanation"></div>
                        </template>
                    </el-alert>

                    <div v-if="!res.is_correct" style="margin-top: 15px; text-align: right;">
                        <el-button type="danger" plain size="small" @click="extraPractice(res)">
                            🔥 针对此弱项加练一组 (WIP)
                        </el-button>
                    </div>
                </el-card>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
               <el-button type="primary" size="large" @click="$router.push('/')">打卡完成，返回主页</el-button>
            </div>
         </div>
      </el-main>

      <!-- 右侧答题网格导航器 -->
      <el-aside width="250px" style="background: transparent; padding-left: 20px;" v-if="tStore.currentPhase === 'answering'">
         <el-card shadow="never">
             <template #header>
                <div style="text-align: center; font-weight: bold;">答题卡矩阵</div>
             </template>
             <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <el-button 
                   v-for="(ex, index) in tStore.exercises" 
                   :key="ex.id"
                   :type="tStore.activeQuestionId === ex.id ? 'primary' : (tStore.userAnswers[ex.id] ? 'success' : 'default')"
                   :plain="tStore.activeQuestionId !== ex.id"
                   style="margin: 0; padding: 0; width: 100%; height: 40px;"
                   @click="tStore.activeQuestionId = ex.id"
                >
                   {{ index + 1 }}
                </el-button>
             </div>
             <div style="margin-top: 30px; text-align: center;">
                 <el-button type="warning" style="width: 100%; font-weight: bold;" @click="submitForEvaluation">
                    交卷批改 💯
                 </el-button>
             </div>
         </el-card>
      </el-aside>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMainStore } from '@/store/mainStore'
import { useTrainingStore } from '@/store/trainingStore'
import syllabusDict from '@/data/syllabus.json'
import GenerateGrammarExerciseSkill from '@/skills/generateExercise.js'
import EvaluateSentenceSkill from '@/skills/evaluateSentence.js'

const route = useRoute()
const store = useMainStore()
const tStore = useTrainingStore()

const currentExercise = computed(() => {
    return tStore.exercises.find(ex => ex.id === tStore.activeQuestionId)
})

const boundInputs = new Set()
const bindWanaKana = (el, id) => {
    // el for el-input returns the component, the internal input is el.$el.querySelector('input')
    const nativeInput = el?.$el?.querySelector('input')
    if (nativeInput && !boundInputs.has(id)) {
        if (window.wanakana) {
            window.wanakana.bind(nativeInput, { IMEMode: true })
            boundInputs.add(id)
        }
    }
}

onMounted(async () => {
    // 只有在没有生成中的任务，且没有已有题库时，才发起新的请求
    // 这阻断了：跳出路由再回来导致重复请求的尴尬
    if (tStore.exercises.length > 0 && !tStore.isGenerating) {
        return; // 复用已有的 Cache！
    }

    if (!route.query.sessionConfig) {
        tStore.generationError = "缺失配置参数，请从主面板进。"
        return;
    }

    const config = JSON.parse(route.query.sessionConfig)
    tStore.initSession(config)
    tStore.isGenerating = true

    const targetLessonId = config.targetLesson || store.progress.current_lesson

    // 组装大纲
    const lessonData = syllabusDict.lessons.find(l => l.id === targetLessonId)
    const context = {
        lesson: lessonData.title,
        grammar_points: lessonData.grammar_points,
        hidden_knowledge: lessonData.hidden_knowledge,
        config: config
    }

    try {
        const skill = new GenerateGrammarExerciseSkill(window.CONFIG.GEMINI_API_KEY)
        const res = await skill.generate(context)
        
        // 我们在 prompt 中告诉模型按量出题，后端直接全量接住并存入 Store
        tStore.setExercises(res.exercises || [])
    } catch (e) {
        tStore.generationError = "生成失败：" + e.message
    }
    
    tStore.isGenerating = false
})

const submitForEvaluation = async () => {
    tStore.isEvaluating = true
    tStore.currentPhase = 'results' // switch to pre-loading ui
    
    const batchArray = tStore.exercises.map(ex => ({
        id: ex.id,
        original_prompt: ex.question || ex.chinese_prompt,
        user_answer: tStore.userAnswers[ex.id] || '',
        type: ex.type
    }))

    try {
        const skill = new EvaluateSentenceSkill(window.CONFIG.GEMINI_API_KEY)
        const targetLessonId = tStore.config?.targetLesson || store.progress.current_lesson
        const res = await skill.evaluate(targetLessonId, batchArray)
        
        let correctCount = 0;
        const finalResults = tStore.exercises.map(ex => {
            const grade = res.find(r => r.id === ex.id) || { is_correct: false, explanation: '批改超时' }
            
            if (!grade.is_correct) {
                store.addMistake({
                    lesson: targetLessonId,
                    grammar_point: ex.type,
                    user_wrong_input: tStore.userAnswers[ex.id],
                    correct_answer: grade.correct_answer
                })
            } else {
                correctCount++;
            }
            
            return {
                ...ex,
                original_question: ex.question || ex.chinese_prompt,
                user_answer: tStore.userAnswers[ex.id],
                is_correct: grade.is_correct,
                correct_answer: grade.correct_answer || ex.answer,
                explanation: grade.explanation + (grade.natural_expression ? `<br><br><b>💡 职场加点料:</b> ${grade.natural_expression}` : '')
            }
        })
        
        // 发放成就判定：当为具体专项且正确率大于 50% 时，赋予通过印记
        const passRate = correctCount / tStore.exercises.length;
        if (tStore.config?.questionType && tStore.config?.questionType !== 'ALL' && passRate >= 0.5) {
            store.markTypeCompleted(targetLessonId, tStore.config.questionType)
        }

        tStore.setEvaluations(finalResults)
    } catch (e) {
        alert("批改时发生错误: " + e.message)
    }
    
    tStore.isEvaluating = false
}

const extraPractice = (gradeInfo) => {
    alert("收到指令！即将唤醒 AI 对此专项进行连环暴击... (功能规划中)")
}

const playAudio = (text) => {
    if ('speechSynthesis' in window) {
        const sentences = new SpeechSynthesisUtterance(text);
        sentences.lang = 'ja-JP';
        sentences.rate = 0.85; // Slightly slower for language learners
        window.speechSynthesis.speak(sentences);
    } else {
        alert("非常抱歉，您的浏览器不支持 Web Speech 语音引擎。");
    }
}
</script>

<style scoped>
.blur-hint-card {
    border: 1px solid #EBEEF5;
    padding: 10px 15px;
    border-radius: 6px;
    background: #fdfdfd;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.blur-hint-card .cn {
    font-weight: bold;
    color: #409EFF;
}

.blur-hint-card .revealer {
    display: inline-flex;
    flex-direction: column;
    margin-left: 10px;
    filter: blur(5px);
    transition: filter 0.3s ease;
    user-select: none;
}

.blur-hint-card:hover .revealer {
    filter: blur(0);
}

.blur-hint-card .kana {
    font-size: 0.75rem;
    color: #909399;
    text-align: center;
}

.blur-hint-card .kanji {
    font-size: 1rem;
    color: #303133;
}
</style>
