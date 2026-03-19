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

  getters: {
    // 总练习题数
    totalExercises(state) {
      const stats = state.progress?.lesson_stats || {};
      return Object.values(stats).reduce((sum, lesson) => {
        return sum + (lesson.last_question_count || 0);
      }, 0);
    },

    // 平均正确率
    avgAccuracy(state) {
      const stats = state.progress?.lesson_stats || {};
      const lessons = Object.values(stats);
      if (lessons.length === 0) return 0;
      
      const totalRate = lessons.reduce((sum, lesson) => {
        return sum + (lesson.last_correct_rate || 0);
      }, 0);
      
      return Math.round((totalRate / lessons.length) * 100) / 100;
    },

    // 连续学习天数
    streakDays(state) {
      const stats = state.progress?.lesson_stats || {};
      const lessons = Object.values(stats);
      if (lessons.length === 0) return 0;

      // 获取所有学习日期（去重，只保留日期部分）
      const studyDates = lessons
        .filter(l => l.last_session_at)
        .map(l => {
          const date = new Date(l.last_session_at);
          return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        })
        .filter((v, i, a) => a.indexOf(v) === i) // 去重
        .sort((a, b) => b - a); // 降序排列

      if (studyDates.length === 0) return 0;

      // 检查今天或昨天是否有学习记录
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const yesterdayMidnight = todayMidnight - 86400000;

      // 如果最新记录不是今天或昨天，连续天数为0
      if (studyDates[0] < yesterdayMidnight) return 0;

      // 从最新日期开始计算连续天数
      let streak = 1;
      let expectedPrev = studyDates[0] - 86400000;

      for (let i = 1; i < studyDates.length; i++) {
        if (studyDates[i] === expectedPrev) {
          streak++;
          expectedPrev -= 86400000;
        } else if (studyDates[i] < expectedPrev) {
          break;
        }
      }

      return streak;
    },

    // 课时热力图数据（最近30天的学习情况）
    heatmapData(state) {
      const stats = state.progress?.lesson_stats || {};
      const lessons = Object.values(stats);
      const heatmap = {};

      // 初始化最近30天
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        heatmap[dateStr] = 0;
      }

      // 统计每天的练习次数
      lessons.forEach(lesson => {
        if (lesson.last_session_at) {
          const dateStr = lesson.last_session_at.split('T')[0];
          if (heatmap[dateStr] !== undefined) {
            heatmap[dateStr]++;
          }
        }
      });

      return heatmap;
    },

    // 题型掌握度统计
    typeMastery(state) {
      const completedTypes = state.progress?.completed_types_by_lesson || {};
      const mastery = { q_fill: 0, q_translate: 0, q_conversation: 0 };
      
      Object.values(completedTypes).forEach(types => {
        if (Array.isArray(types)) {
          types.forEach(t => { if (mastery[t] !== undefined) mastery[t]++; });
        } else if (typeof types === 'object') {
          Object.keys(types).forEach(t => { if (mastery[t] !== undefined) mastery[t]++; });
        }
      });

      return mastery;
    },

    // 历史正确率趋势
    accuracyTrend(state) {
      const stats = state.progress?.lesson_stats || {};
      return Object.values(stats)
        .filter(l => l.last_session_at)
        .sort((a, b) => new Date(a.last_session_at) - new Date(b.last_session_at))
        .map(l => ({
          date: l.last_session_at.split('T')[0],
          rate: Math.round((l.last_correct_rate || 0) * 100),
          lesson: l.lesson_id
        }))
        .slice(-10); // 最近10次
    }
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
