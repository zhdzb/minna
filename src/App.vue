<template>
  <el-config-provider>
    <div id="app-container" style="height: 100vh; overflow: hidden;">
      <el-container style="height: 100%; background: transparent;">
        <el-aside
          width="220px"
          :style="{
            backgroundColor: isAcgDark ? 'rgba(20, 15, 25, 0.4)' : '#2c3e50',
            backdropFilter: isAcgDark ? 'blur(10px)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isAcgDark ? '1px solid rgba(255,126,179,0.1)' : 'none'
          }"
        >
          <div
            :style="{
              padding: '20px',
              color: isAcgDark ? '#ff99c4' : 'white',
              fontWeight: 'bold',
              textAlign: 'center',
              fontSize: '1.2rem',
              borderBottom: isAcgDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #1a252f'
            }"
          >
            Codex Study Loop
          </div>

          <el-menu
            :default-active="activePath"
            class="el-menu-vertical"
            :background-color="isAcgDark ? 'transparent' : '#2c3e50'"
            :text-color="isAcgDark ? '#e2d5ec' : '#aeb9c2'"
            :active-text-color="isAcgDark ? '#ff7eb3' : '#42b983'"
            router
            style="border-right: none; flex: 1;"
          >
            <el-menu-item index="/agent-study">
              <span>Agent Study</span>
            </el-menu-item>
            <el-menu-item index="/agent-progress-review">
              <span>Progress Review</span>
            </el-menu-item>
            <el-menu-item index="/agent-review-drill">
              <span>Review Drill</span>
            </el-menu-item>
          </el-menu>

          <div
            :style="{
              padding: '20px',
              textAlign: 'center',
              borderTop: isAcgDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #1a252f'
            }"
          >
            <p :style="{ color: isAcgDark ? '#b3aebd' : '#666', fontSize: '0.8rem', marginBottom: '10px' }">
              Current lesson: {{ store.progress.current_lesson }}
            </p>
            <el-button
              type="warning"
              plain
              size="small"
              @click="createBackup"
              style="width: 100%; margin-bottom: 10px;"
            >
              Save Snapshot
            </el-button>
            <el-button
              type="info"
              plain
              size="small"
              @click="exportData"
              style="width: 100%; margin-bottom: 10px;"
            >
              Export Backup
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="fileInput?.click()"
              style="width: 100%; margin: 0;"
            >
              Import Backup
            </el-button>
            <input type="file" ref="fileInput" accept=".json" style="display: none;" @change="importData" />
          </div>
        </el-aside>

        <el-main style="padding: 0; background: transparent;">
          <el-main class="app-main">
            <router-view />
          </el-main>
        </el-main>
      </el-container>

      <div class="theme-toggle-fab">
        <el-switch
          v-model="isAcgDark"
          inline-prompt
          style="--el-switch-on-color: #8b5cf6; --el-switch-off-color: #4b5563"
          active-text="Focus"
          inactive-text="Plain"
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

const store = useMainStore()
const router = useRouter()
const fileInput = ref(null)
const isAcgDark = ref(false)

const activePath = computed(() => router?.currentRoute?.value?.path || '/agent-study')

const toggleTheme = (value) => {
  isAcgDark.value = value
  document.documentElement.classList.add('dark')

  if (value) {
    document.documentElement.classList.add('acg-theme')
  } else {
    document.documentElement.classList.remove('acg-theme')
  }
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
      ElMessage.error(`Save failed: ${value}`)
    }
  }
)

const createBackup = () => {
  store.createBackupSnapshot('manual')
  ElMessage.success('Local snapshot saved.')
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
  ElMessage.success('Backup exported.')
}

const importData = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = validateBackupPayloadShape(JSON.parse(text))

    await ElMessageBox.confirm(
      'Importing will overwrite the current study progress. Export a backup first if needed. Continue?',
      'Confirm Import',
      {
        confirmButtonText: 'Import',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )

    store.overwriteState(data)
    ElMessage.success('Backup imported.')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      ElMessage.info('Import canceled.')
    } else {
      ElMessage.error(`Import failed: ${error.message}`)
    }
  }

  event.target.value = ''
}
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
</style>
