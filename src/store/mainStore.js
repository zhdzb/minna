import { defineStore } from 'pinia'

// 初始化默认进度数据 (包含新版题型细粒度控制)
const getDefaultData = () => ({
  progress: {
    current_lesson: 1,
    // 进度粒度可以细化，比如 { "1": ["q_fill", "q_translate"] } 表示第一课已经完成的题型
    completed_types_by_lesson: {},
    pass_threshold: 0.5,
    lesson_stats: {}
  },
  mistakes_book: [],
  meta: {
    updated_at: null
  }
})

const normalizeData = (data) => {
  const base = getDefaultData()
  const merged = {
    ...base,
    ...data,
    progress: {
      ...base.progress,
      ...(data?.progress || {})
    },
    mistakes_book: Array.isArray(data?.mistakes_book) ? data.mistakes_book : base.mistakes_book,
    meta: {
      ...base.meta,
      ...(data?.meta || {})
    }
  }

  if (Array.isArray(data?.collections) && data.collections.length > 0) {
    merged.mistakes_book = [
      ...merged.mistakes_book,
      ...data.collections.map((item) => ({
        id: item.id || Date.now().toString(),
        timestamp: item.timestamp || new Date().toISOString(),
        mark_type: 'favorite',
        ...item
      }))
    ]
  }

  return merged
}

export const useMainStore = defineStore('main', {
  state: () => {
    // 纯粹的按新版 schema 读取
    const saved = localStorage.getItem('minna_app_data')
    if (saved) {
      try {
        return normalizeData(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse localStorage data, returning default', e)
      }
    }
    return getDefaultData()
  },
  
  actions: {
    // 保存至 LocalStorage 供随时读取，同时静默同步给本地物理文件 data.json (需在开发环境下通过 Vite 插件支持)
    saveState() {
      if (!this.meta) this.meta = {}
      this.meta.updated_at = new Date().toISOString()
      const stateStr = JSON.stringify(this.$state, null, 2)
      localStorage.setItem('minna_app_data', stateStr)
      
      // 静默发给本地 Vite 服务器写入本地磁盘，允许 git 自动追踪！
      fetch('/api/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: stateStr
      }).catch(err => {
          console.warn("自动磁盘同步失败 (或许处于纯静态生产部署中): ", err)
      })
    },

    addReviewItem(item, markType = 'mistake') {
      this.mistakes_book.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        mark_type: markType,
        ...item
      })
      this.saveState()
    },

    // 记录错题
    addMistake(mistake) {
      this.addReviewItem(mistake, 'mistake')
    },

    setPassThreshold(value) {
      const num = Number(value)
      if (Number.isNaN(num)) return
      const clamped = Math.max(0.3, Math.min(1, num))
      this.progress.pass_threshold = clamped
      this.saveState()
    },

    recordLessonStats(lessonId, stats) {
      if (!this.progress.lesson_stats) {
        this.progress.lesson_stats = {}
      }
      this.progress.lesson_stats[lessonId] = {
        lesson_id: lessonId,
        last_session_at: new Date().toISOString(),
        last_question_count: stats?.question_count || 0,
        last_correct_count: stats?.correct_count || 0,
        last_correct_rate: stats?.correct_rate || 0,
        last_difficulty: stats?.difficulty || '',
        last_question_type: stats?.question_type || ''
      }
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

    // 允许用户在仪表盘手动干预/切换某课某个小类的通关状态
    toggleTypeCompletion(lessonId, typeId) {
      if (!this.progress.completed_types_by_lesson[lessonId]) {
        this.progress.completed_types_by_lesson[lessonId] = {}
      }
      
      let typedata = this.progress.completed_types_by_lesson[lessonId];
      if (Array.isArray(typedata)) {
        const migrated = {};
        typedata.forEach(t => { migrated[t] = '基础巩固' });
        this.progress.completed_types_by_lesson[lessonId] = migrated;
        typedata = migrated;
      }
      
      if (typedata[typeId]) {
          // 已存在则移除（取消点亮）
          delete typedata[typeId];
      } else {
          // 不存在则点亮，默认授予“免试特批”标记
          typedata[typeId] = '特批免试';
      }
      
      this.saveState();
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

    // 推进主线进度
    advanceLesson() {
      // 简单递增，但可以增加验证判断是否超过总课数上限
      this.progress.current_lesson += 1
      this.saveState()
    },
 
    async hydrateFromDisk() {
      try {
        const res = await fetch('/data.json', { cache: 'no-cache' })
        if (!res.ok) return
        const diskData = normalizeData(await res.json())
        const localUpdated = this.meta?.updated_at ? new Date(this.meta.updated_at).getTime() : 0
        const diskUpdated = diskData.meta?.updated_at ? new Date(diskData.meta.updated_at).getTime() : 0
        const hasLocal = !!localStorage.getItem('minna_app_data')

        if (!hasLocal) {
          this.$patch(diskData)
          this.saveState()
          return
        }

        const isLocalEmpty =
          this.progress.current_lesson === 1 &&
          Object.keys(this.progress.completed_types_by_lesson || {}).length === 0 &&
          (this.mistakes_book || []).length === 0

        if (diskUpdated > localUpdated || isLocalEmpty) {
          this.$patch(diskData)
          this.saveState()
        }
      } catch (e) {
        return
      }
    },
    
    // 全库导入或覆盖恢复 (Git Sync 导入时用)
    overwriteState(newState) {
      this.$patch(normalizeData(newState))
      this.saveState()
    }
  }
})
