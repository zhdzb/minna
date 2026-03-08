import { defineStore } from 'pinia'

// 初始化默认进度数据 (包含新版题型细粒度控制)
const getDefaultData = () => ({
  progress: {
    current_lesson: 1,
    // 进度粒度可以细化，比如 { "1": ["q_fill", "q_translate"] } 表示第一课已经完成的题型
    completed_types_by_lesson: {} 
  },
  mistakes_book: [],
  collections: []
})

export const useMainStore = defineStore('main', {
  state: () => {
    // 纯粹的按新版 schema 读取
    const saved = localStorage.getItem('minna_no_nihongo_data')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse localStorage data, returning default', e)
      }
    }
    return getDefaultData()
  },
  
  actions: {
    // 保存至 LocalStorage 供随时读取，同时静默同步给本地物理文件 data.json (需在开发环境下通过 Vite 插件支持)
    saveState() {
      const stateStr = JSON.stringify(this.$state, null, 2)
      localStorage.setItem('minna_no_nihongo_data', stateStr)
      
      // 静默发给本地 Vite 服务器写入本地磁盘，允许 git 自动追踪！
      fetch('/api/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: stateStr
      }).catch(err => {
          console.warn("自动磁盘同步失败 (或许处于纯静态生产部署中): ", err)
      })
    },

    // 记录错题
    addMistake(mistake) {
      this.mistakes_book.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...mistake
      })
      this.saveState()
    },

    // 完成某一课的某一种题型
    markTypeCompleted(lessonId, typeId) {
      if (!this.progress.completed_types_by_lesson[lessonId]) {
        this.progress.completed_types_by_lesson[lessonId] = []
      }
      const types = this.progress.completed_types_by_lesson[lessonId]
      if (!types.includes(typeId)) {
        types.push(typeId)
      }
      this.saveState()
    },

    // 升级课时 (当该课所有支持的题型全通关后)
    advanceLesson() {
      this.progress.current_lesson++
      this.saveState()
    },

    // 检查并自动推进主线进度
    checkAndAdvanceLesson(targetLessonId, enabledTypes) {
      if (targetLessonId === this.progress.current_lesson) {
        const completed = this.progress.completed_types_by_lesson[targetLessonId] || []
        const isAllCleared = enabledTypes.every(type => completed.includes(type))
        if (isAllCleared) {
          this.advanceLesson()
          return true
        }
      }
      return false
    },
    
    // 全库导入或覆盖恢复 (Git Sync 导入时用)
    overwriteState(newState) {
      this.$patch(newState)
      this.saveState()
    }
  }
})
