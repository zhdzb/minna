<template>
  <div>
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div style="font-size: 1.1rem; font-weight: bold;">
          系统设置
        </div>
      </template>
      <p style="color: #666; font-size: 0.9rem; margin: 0;">
        这里主要处理两类内容：AI 配置，以及学习数据的备份与恢复。
      </p>
    </el-card>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>Gemini API</span>
          </template>
          <div style="margin-bottom: 15px; font-size: 0.9rem; color: #888;">
            API Key 只保存在当前浏览器，不会被写入项目代码。
          </div>
          <el-input
            v-model="apiKeyInput"
            placeholder="AIza..."
            type="password"
            show-password
          />
          <div style="margin-top: 15px; text-align: right;">
            <el-button type="primary" @click="saveApiKey">保存 API Key</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>背景图</span>
          </template>
          <div style="margin-bottom: 15px; font-size: 0.9rem; color: #888;">
            可选。设置后会在沉浸模式下作为背景图使用。
          </div>
          <el-input
            v-model="acgBgInput"
            placeholder="https://example.com/background.png"
            clearable
          />
          <div style="margin-top: 15px; text-align: right;">
            <el-button type="primary" @click="saveBgUrl">应用背景图</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>学习存档</span>
          <el-button type="warning" plain @click="createBackup">新建存档</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 16px;"
        title="本地存档适合同一台设备上回滚；跨设备同步请使用左侧的导出/导入备份。"
      />

      <el-empty v-if="backups.length === 0" description="还没有本地存档" />

      <el-table v-else :data="backups" style="width: 100%;">
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="label" label="标签" min-width="120">
          <template #default="{ row }">
            {{ row.label || 'manual' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <div style="display: flex; gap: 8px;">
              <el-button size="small" type="primary" plain @click="restoreBackup(row.id)">
                恢复
              </el-button>
              <el-button size="small" type="danger" plain @click="removeBackup(row.id)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMainStore } from '@/store/mainStore'

const store = useMainStore()
const apiKeyInput = ref('')
const acgBgInput = ref('')

const backups = computed(() => store.study_backups)

onMounted(() => {
  apiKeyInput.value = localStorage.getItem('gemini_api_key') || ''
  acgBgInput.value = localStorage.getItem('custom_acg_bg') || ''
})

const formatTime = (ts) => {
  if (!ts) return '未知时间'
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const saveApiKey = () => {
  const value = apiKeyInput.value.trim()
  if (value) {
    localStorage.setItem('gemini_api_key', value)
    ElMessage.success('API Key 已保存。')
    return
  }

  localStorage.removeItem('gemini_api_key')
  ElMessage.warning('API Key 已清除。')
}

const saveBgUrl = () => {
  localStorage.setItem('custom_acg_bg', acgBgInput.value.trim())
  window.dispatchEvent(new Event('bg-url-changed'))
  ElMessage.success('背景图已更新。')
}

const createBackup = () => {
  store.createBackupSnapshot('settings')
  ElMessage.success('已创建本地学习存档。')
}

const restoreBackup = (id) => {
  ElMessageBox.confirm(
    '恢复存档会覆盖当前学习进度和错题记录。是否继续？',
    '恢复存档',
    {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      const restored = store.restoreBackupSnapshot(id)
      if (restored) {
        ElMessage.success('存档已恢复。')
      } else {
        ElMessage.error('未找到该存档。')
      }
    })
    .catch(() => {})
}

const removeBackup = (id) => {
  store.removeBackupSnapshot(id)
  ElMessage.success('本地存档已删除。')
}
</script>
