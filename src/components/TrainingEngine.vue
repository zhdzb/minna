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
            <div style="font-size: 1.2rem; margin-bottom: 8px; color: #409EFF;">
               <i class="el-icon-edit-outline"></i> 正在挑战: {{ tStore.currentConfig?.difficulty }} ( 第 {{ tStore.currentConfig?.targetLesson || store.progress.current_lesson }} 课 )
            </div>
            <div style="font-size: 0.9rem; color: #888; margin-bottom: 20px;">
               已作答 {{ answeredCount }} / {{ totalCount }} 题
            </div>

            <!-- 当前选中的题目卡片 -->
            <transition name="el-fade-in" mode="out-in">
                <div :key="currentExercise?.id || 'empty_state'">
                    <el-card v-if="currentExercise" style="min-height: 250px;">
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
                             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                 <p style="font-size: 0.8rem; color: #888; margin: 0;">
                                  🚀 在此输入即可自动转假名。(片假名请大写锁定输入)
                                 </p>
                                 <el-tooltip placement="top-end">
                                    <template #content>
                                        <b>💡 罗马音输入速决小贴士：</b><br/>
                                        1. <b>【促音】</b>双打下一个假名的辅音字母 (如 tte = って)<br/>
                                        2. <b>【拨音】</b>连按两次 n (如 nn = ん)<br/>
                                        3. <b>【小假名】</b>在元音前加 x 或 l (如 xya / lya = ゃ)<br/>
                                        4. <b>【长音】</b>使用短横线 - (如 bi-ru = ビール)
                                    </template>
                                    <el-tag size="small" type="info" style="cursor: help;">⌨️ 罗马音速查表</el-tag>
                                 </el-tooltip>
                             </div>
                             <el-input 
                                v-model="tStore.userAnswers[currentExercise.id]"
                                :ref="(el) => bindWanaKana(el, currentExercise.id)"
                                @blur="forceKanaConversion(currentExercise.id)"
                                placeholder="Type in romaji..."
                                size="large"
                                clearable
                             />
                        </div>
                    </el-card>
                </div>
            </transition>

            <!-- 底部 上一题/下一题 导航 -->
            <div style="margin-top: 20px; display: flex; justify-content: space-between;">
                <el-button 
                    type="primary" 
                    plain 
                    icon="el-icon-arrow-left" 
                    :disabled="currentQuestionIndex === 0"
                    @click="goToNextQuestion(-1)"
                >
                    上一题
                </el-button>
                <el-button 
                    type="primary" 
                    plain 
                    :disabled="currentQuestionIndex === tStore.exercises.length - 1"
                    @click="goToNextQuestion(1)"
                >
                    下一题 <i class="el-icon-arrow-right el-icon--right"></i>
                </el-button>
            </div>
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

                    <div style="margin-top: 15px; text-align: right; display: flex; justify-content: flex-end; gap: 10px;">
                        <el-button 
                            type="warning" 
                            plain 
                            size="small" 
                            :disabled="savedReviewIds.has(`${res.id}:mistake`)"
                            @click="saveReviewItem(res, 'mistake')"
                            v-if="!res.is_correct"
                        >
                            {{ savedReviewIds.has(`${res.id}:mistake`) ? '✅ 已加入错题本' : '📓 加入错题本' }}
                        </el-button>
                        <el-button 
                            type="success" 
                            plain 
                            size="small" 
                            :disabled="savedReviewIds.has(`${res.id}:favorite`)"
                            @click="saveReviewItem(res, 'favorite')"
                        >
                            {{ savedReviewIds.has(`${res.id}:favorite`) ? '✅ 已收藏' : '⭐ 收藏本题' }}
                        </el-button>
                        <el-button type="danger" plain size="small" @click="extraPractice(res)" v-if="false">
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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

const currentQuestionIndex = computed(() => {
    return tStore.exercises.findIndex(ex => ex.id === tStore.activeQuestionId)
})

const goToNextQuestion = (step) => {
    const newIndex = currentQuestionIndex.value + step;
    if (newIndex >= 0 && newIndex < tStore.exercises.length) {
        // 切换前，强制刷入一次假名，防止用户没有失焦直接点按钮导致字母残留
        forceKanaConversion(tStore.activeQuestionId);
        tStore.activeQuestionId = tStore.exercises[newIndex].id;
    }
}

const forceKanaConversion = (id) => {
    if (tStore.userAnswers[id] && window.wanakana) {
        // 强制把还未转换的孤立辅音 (如 n) 转化为假名
        tStore.userAnswers[id] = window.wanakana.toKana(tStore.userAnswers[id], { IMEMode: true })
    }
}

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

const savedReviewIds = ref(new Set())

const saveReviewItem = (res, markType) => {
    const key = `${res.id}:${markType}`
    if (savedReviewIds.value.has(key)) return;
    
    const targetLessonId = tStore.currentConfig?.targetLesson || store.progress.current_lesson
    store.addReviewItem({
        original_question: res.original_question,
        lesson: targetLessonId,
        grammar_point: res.type,
        user_wrong_input: res.user_answer,
        correct_answer: res.correct_answer,
        explanation: res.explanation
    }, markType)
    savedReviewIds.value.add(key)
}

const startSession = async () => {
    const queryConfigStr = route.query.sessionConfig;
    const queryTimestamp = route.query.t;
    
    if (!queryConfigStr) {
        tStore.generationError = "缺失配置参数，请从主面板进。"
        return;
    }

    // 处理缓存复用逻辑
    if (tStore.exercises.length > 0 && !tStore.isGenerating) {
        if (tStore.generationError) {
            tStore.clearSession()
        } 
        else if (tStore.currentPhase === 'results') {
            tStore.clearSession()
        }
        else if (tStore.sessionTimestamp == queryTimestamp) {
            // 时间戳一致，说明是要恢复当前的答卷记录（通过后退切回来、或点击“继续答题”）
            return; 
        }
        else if (!queryTimestamp && tStore.currentConfig) {
            // 没有带来时间戳，且已经有数据，大概率是直接刷新或者旧路由遗留，安全地恢复
            return;
        }
        else {
            // 带了新的时间戳，代表用户通过面板点击了“发起新的训练请求”
            tStore.clearSession()
        }
    }

    const config = JSON.parse(queryConfigStr)
    tStore.initSession(config, queryTimestamp)
    tStore.isGenerating = true
    savedReviewIds.value.clear()

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
}

onMounted(() => {
    startSession()
})

const submitForEvaluation = async () => {
    tStore.isEvaluating = true
    tStore.currentPhase = 'results' // switch to pre-loading ui
    
    const nonFillExercises = tStore.exercises.filter(ex => ex.type !== 'q_fill')
    const batchArray = nonFillExercises.map(ex => ({
        id: ex.id,
        original_prompt: ex.question || ex.chinese_prompt,
        user_answer: tStore.userAnswers[ex.id] || '',
        type: ex.type
    }))

    try {
        const targetLessonId = tStore.currentConfig?.targetLesson || store.progress.current_lesson
        let res = []
        if (batchArray.length > 0) {
            const skill = new EvaluateSentenceSkill(window.CONFIG.GEMINI_API_KEY)
            res = await skill.evaluate(targetLessonId, batchArray)
        }
        
        const gradeMap = Array.isArray(res)
            ? new Map(res.map(item => [String(item.id), item]))
            : new Map()

        let correctCount = 0;
        const finalResults = tStore.exercises.map(ex => {
            if (ex.type === 'q_fill') {
                const userAnswer = tStore.userAnswers[ex.id] || ''
                const correctAnswer = ex.answer || ''
                const isCorrect = !!correctAnswer && userAnswer === correctAnswer
                if (isCorrect) correctCount++
                return {
                    ...ex,
                    original_question: ex.question || ex.chinese_prompt,
                    user_answer: userAnswer,
                    is_correct: isCorrect,
                    correct_answer: correctAnswer,
                    explanation: isCorrect ? '回答正确。' : '答案不正确。'
                }
            }

            const grade = gradeMap.get(String(ex.id)) || { is_correct: false, explanation: '批改超时' }
            if (grade.is_correct) correctCount++
            
            return {
                ...ex,
                original_question: ex.question || ex.chinese_prompt,
                user_answer: tStore.userAnswers[ex.id],
                is_correct: grade.is_correct,
                correct_answer: grade.correct_answer || ex.answer,
                explanation: grade.explanation + (grade.natural_expression ? `<br><br><b>💡 职场加点料:</b> ${grade.natural_expression}` : '')
            }
        })
        
        const totalCount = tStore.exercises.length
        const passRate = totalCount > 0 ? correctCount / totalCount : 0
        store.recordLessonStats(targetLessonId, {
            question_count: totalCount,
            correct_count: correctCount,
            correct_rate: passRate,
            difficulty: tStore.currentConfig?.difficulty || '',
            question_type: tStore.currentConfig?.questionType || ''
        })

        const passThreshold = store.progress.pass_threshold || 0.5
        if (passRate >= passThreshold) {
            const lessonData = syllabusDict.lessons.find(l => l.id === targetLessonId)
            
            if (tStore.currentConfig?.questionType === 'ALL') {
                // 如果是混合实战 ALL 型过关，直接点亮该课所有启用的题型专属印记！
                if (lessonData && lessonData.enabled_question_types) {
                    lessonData.enabled_question_types.forEach(type => {
                        store.markTypeCompleted(targetLessonId, type, tStore.currentConfig?.difficulty);
                    });
                }
            } else if (tStore.currentConfig?.questionType) {
                // 普通专项过关
                store.markTypeCompleted(targetLessonId, tStore.currentConfig.questionType, tStore.currentConfig?.difficulty)
            }
            
            // 检查大满贯晋升
            if (lessonData && lessonData.enabled_question_types) {
                const isAdvanced = store.checkAndAdvanceLesson(targetLessonId, lessonData.enabled_question_types)
                if (isAdvanced) {
                   setTimeout(() => {
                       alert(`🎉 恭喜！您已通关第 ${targetLessonId} 课的所有考核！主线进度已自动飞升至第 ${store.progress.current_lesson} 课！`)
                   }, 500)
                }
            }
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

const totalCount = computed(() => tStore.exercises.length)
const answeredCount = computed(() => {
    return tStore.exercises.filter(ex => {
        const val = tStore.userAnswers[ex.id]
        return val !== undefined && val !== null && String(val).trim() !== ''
    }).length
})
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
