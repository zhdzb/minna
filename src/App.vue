<template>
  <el-config-provider>
    <div id="app-container" class="app-shell">
      <el-container class="app-shell-frame">
        <el-aside class="app-shell-sidebar" width="220px">
          <div class="app-shell-brand">Codex Study Loop</div>

          <el-menu
            :default-active="activePath"
            class="app-shell-menu"
            :background-color="isAcgDark ? 'transparent' : '#1f2937'"
            :text-color="isAcgDark ? '#dbe4ff' : '#cbd5e1'"
            :active-text-color="isAcgDark ? '#f9a8d4' : '#93c5fd'"
            router
          >
            <el-menu-item index="/agent-study">
              <span>学习工作台</span>
            </el-menu-item>
            <el-menu-item index="/agent-progress-review">
              <span>进度总览</span>
            </el-menu-item>
            <el-menu-item index="/agent-review-drill">
              <span>复习训练</span>
            </el-menu-item>
            <el-menu-item index="/syllabus">
              <span>课纲管理</span>
            </el-menu-item>
          </el-menu>

          <div class="app-shell-sidebar-footer">
            <p class="app-shell-lesson">当前课程：第 {{ currentLesson }} 课</p>
            <p class="app-shell-phase">{{ currentPhaseLabel }}</p>
            <el-button type="warning" plain size="small" @click="createBackup">保存快照</el-button>
            <el-button type="info" plain size="small" @click="exportData">导出备份</el-button>
            <el-button type="success" size="small" @click="fileInput?.click()">导入备份</el-button>
            <input type="file" ref="fileInput" accept=".json" hidden @change="importData" />
          </div>
        </el-aside>

        <el-main class="app-shell-main">
          <router-view />
        </el-main>
      </el-container>

      <div class="theme-toggle-fab">
        <el-switch
          v-model="isAcgDark"
          inline-prompt
          style="--el-switch-on-color: #8b5cf6; --el-switch-off-color: #4b5563"
          active-text="暗"
          inactive-text="亮"
          @change="toggleTheme"
        />
      </div>
    </div>
  </el-config-provider>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { buildPersistableState, useMainStore } from '@/store/mainStore'
import { validateBackupPayloadShape } from '@/utils/backupPayload'
import { createAgentStudyClient } from '@/utils/agentStudyClient'
import { getAgentStudyPhaseDetails } from '@/utils/agentStudyPhase'

const store = useMainStore()
const router = useRouter()
const fileInput = ref(null)
const isAcgDark = ref(false)
const agentProgress = ref(null)

const activePath = computed(() => router?.currentRoute?.value?.path || '/agent-study')
const currentLesson = computed(() => agentProgress.value?.current?.current_lesson || store.progress.current_lesson)
const currentPhaseLabel = computed(() =>
  agentProgress.value?.phase
    ? getAgentStudyPhaseDetails(agentProgress.value.phase).label
    : 'Agent Study 状态加载中'
)

const syncThemeClass = (enabled) => {
  document.documentElement.classList.toggle('dark', enabled)
  document.documentElement.classList.toggle('acg-theme', enabled)
  document.body.classList.toggle('dark', enabled)
  document.body.classList.toggle('acg-theme', enabled)
}

const toggleTheme = (value) => {
  isAcgDark.value = value
  syncThemeClass(value)
}

const handleKeyDown = (event) => {
  if (event.altKey && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    toggleTheme(!isAcgDark.value)
  }
}

const applyCustomBg = () => {
  const customBg = localStorage.getItem('custom_acg_bg')
  if (customBg) {
    document.documentElement.style.setProperty('--acg-custom-bg', `url("${customBg}")`)
  } else {
    document.documentElement.style.removeProperty('--acg-custom-bg')
  }
}

const buildExportFileName = () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`
  return `minna-study-backup_${stamp}.json`
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('bg-url-changed', applyCustomBg)

  applyCustomBg()

  const savedTheme = localStorage.getItem('theme_acg_dark')
  toggleTheme(savedTheme === null ? true : savedTheme === 'true')

  await store.hydrateFromDisk()
  try {
    agentProgress.value = await createAgentStudyClient().loadProgressReview()
  } catch (_error) {
    agentProgress.value = null
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('bg-url-changed', applyCustomBg)
})

watch(isAcgDark, (value) => {
  localStorage.setItem('theme_acg_dark', String(value))
})

watch(
  () => store.meta?.last_persistence_error,
  (value, previous) => {
    if (value && value !== previous) {
      ElMessage.error(`保存失败：${value}`)
    }
  }
)

const createBackup = () => {
  store.createBackupSnapshot('manual')
  ElMessage.success('本地快照已保存。')
}

const exportData = () => {
  const dataStr = JSON.stringify(buildPersistableState(store.$state), null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildExportFileName()
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  ElMessage.success('备份已导出。')
}

const importData = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = validateBackupPayloadShape(JSON.parse(text))

    await ElMessageBox.confirm(
      '导入会覆盖当前学习进度。如有需要，请先导出备份。是否继续？',
      '确认导入',
      {
        confirmButtonText: '确认导入',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    store.overwriteState(data)
    ElMessage.success('备份已导入。')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      ElMessage.info('已取消导入。')
    } else {
      ElMessage.error(`导入失败：${error.message}`)
    }
  }

  event.target.value = ''
}
</script>

<style>
:root {
  color-scheme: light;
  --app-page-bg: #f3f6fb;
  --app-page-grad: radial-gradient(circle at top, rgba(129, 140, 248, 0.12), transparent 40%);
  --app-panel-bg: rgba(255, 255, 255, 0.94);
  --app-card-bg: #fbfdff;
  --app-soft-bg: #f8fafc;
  --app-border: #dbe3f1;
  --app-border-strong: #cbd5e1;
  --app-text: #1f2937;
  --app-text-strong: #0f172a;
  --app-text-muted: #475569;
  --app-text-soft: #64748b;
  --app-accent: #4f46e5;
  --app-chip-bg: #eef2ff;
  --app-chip-text: #3730a3;
  --app-chip-warn-bg: #fff7ed;
  --app-chip-warn-text: #b45309;
  --app-success: #166534;
  --app-danger: #b91c1c;
  --app-sidebar-bg: #1f2937;
  --app-sidebar-border: rgba(255, 255, 255, 0.08);
}

html.dark {
  color-scheme: dark;
  --app-page-bg: #08111f;
  --app-page-grad: radial-gradient(circle at top, rgba(168, 85, 247, 0.18), transparent 42%);
  --app-panel-bg: rgba(9, 16, 29, 0.86);
  --app-card-bg: rgba(15, 23, 42, 0.94);
  --app-soft-bg: rgba(30, 41, 59, 0.92);
  --app-border: rgba(148, 163, 184, 0.26);
  --app-border-strong: rgba(148, 163, 184, 0.34);
  --app-text: #e5eefb;
  --app-text-strong: #f8fafc;
  --app-text-muted: #cbd5e1;
  --app-text-soft: #94a3b8;
  --app-accent: #c4b5fd;
  --app-chip-bg: rgba(99, 102, 241, 0.22);
  --app-chip-text: #dbe4ff;
  --app-chip-warn-bg: rgba(180, 83, 9, 0.18);
  --app-chip-warn-text: #fdba74;
  --app-success: #86efac;
  --app-danger: #fca5a5;
  --app-sidebar-bg: rgba(5, 10, 20, 0.88);
  --app-sidebar-border: rgba(196, 181, 253, 0.16);
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--app-page-grad), var(--app-page-bg);
  color: var(--app-text);
}

.app-shell {
  height: 100vh;
  overflow: hidden;
  background: var(--app-page-grad), var(--app-page-bg);
}

.app-shell-frame {
  height: 100%;
  background: transparent;
}

.app-shell-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--app-sidebar-bg);
  border-right: 1px solid var(--app-sidebar-border);
  backdrop-filter: blur(14px);
}

.app-shell-brand {
  padding: 20px;
  color: #f8fafc;
  font-weight: 700;
  text-align: center;
  font-size: 1.1rem;
  border-bottom: 1px solid var(--app-sidebar-border);
}

.app-shell-menu {
  flex: 1;
  border-right: none;
}

.app-shell-sidebar-footer {
  display: grid;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid var(--app-sidebar-border);
}

.app-shell-lesson {
  margin: 0 0 4px;
  font-size: 0.85rem;
  color: #cbd5e1;
  text-align: center;
}

.app-shell-phase {
  margin: -4px 0 4px;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.app-shell-main {
  padding: 0;
  overflow: auto;
  background: transparent;
}

.app-main {
  min-height: 100%;
}

.theme-toggle-fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 20;
  padding: 10px 12px;
  border-radius: 999px;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(12px);
}

@media (max-width: 900px) {
  .app-shell-sidebar {
    width: 180px !important;
  }
}
</style>
