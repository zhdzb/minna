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

    // 完成某一课的某一种题型，并物理挂载最高通关难度
    markTypeCompleted(lessonId, typeId, difficulty = '基础巩固') {
      if (!this.progress.completed_types_by_lesson[lessonId]) {
        this.progress.completed_types_by_lesson[lessonId] = {}
      }
      
      let typedata = this.progress.completed_types_by_lesson[lessonId];
      
      // 平滑向下兼容：将早期旧版的 Array 格式进度，静默升级为 JSON Object 结构
      if (Array.isArray(typedata)) {
        const migrated = {};
        typedata.forEach(t => { migrated[t] = '基础巩固' });
        this.progress.completed_types_by_lesson[lessonId] = migrated;
        typedata = migrated;
      }
      
      // 难度阶梯权重判定：高难度会覆盖低难度记录，低难度拒绝覆盖高难度
      const difficultyLevels = { '基础巩固': 1, '职场进阶': 2, 'JLPT真题级': 3 };
      const currentLevel = difficultyLevels[difficulty] || 1;
      const existingLevel = difficultyLevels[typedata[typeId]] || 0;
      
      if (currentLevel > existingLevel) {
          typedata[typeId] = difficulty;
      }
      
      this.saveState()
    },

    // 检查并自动推进主线进度
    checkAndAdvanceLesson(targetLessonId, enabledTypes) {
      if (targetLessonId === this.progress.current_lesson) {
        let typedata = this.progress.completed_types_by_lesson[targetLessonId] || {}
        if (Array.isArray(typedata)) {
            const migrated = {};
            typedata.forEach(t => { migrated[t] = '基础巩固' });
            typedata = migrated;
        }
        
        const isAllCleared = enabledTypes.every(type => Object.keys(typedata).includes(type))
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
