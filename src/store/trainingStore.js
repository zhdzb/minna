import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTrainingStore = defineStore('training', () => {
    // 状态定义
    const isGenerating = ref(false)
    const isEvaluating = ref(false)
    const generationError = ref('')
    
    // 当前出题配置副本
    const currentConfig = ref(null)
    const currentPhase = ref('answering') // answering | results
    
    // 核心数据
    const exercises = ref([])
    const evaluations = ref([])
    const userAnswers = ref({}) // { uuid: '回答' }
    
    // 当前聚焦的题号 (代替粗暴的 currentIndex)
    const activeQuestionId = ref(null)

    // Action: 初始化空状态
    const initSession = (config) => {
        currentConfig.value = config
        exercises.value = []
        evaluations.value = []
        userAnswers.value = {}
        generationError.value = ''
        currentPhase.value = 'answering'
        activeQuestionId.value = null
    }

    // Action: 存入生成的题目
    const setExercises = (newExercises) => {
        exercises.value = newExercises
        if(newExercises.length > 0) {
            activeQuestionId.value = newExercises[0].id
        }
    }

    // Action: 存入批改结果
    const setEvaluations = (results) => {
        evaluations.value = results
        currentPhase.value = 'results'
    }

    return {
        isGenerating,
        isEvaluating,
        generationError,
        currentConfig,
        currentPhase,
        exercises,
        evaluations,
        userAnswers,
        activeQuestionId,
        initSession,
        setExercises,
        setEvaluations
    }
})
