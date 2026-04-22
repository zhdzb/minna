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
            <span>模型 Provider</span>
          </template>
          <div style="margin-bottom: 12px; font-size: 0.9rem; color: #888;">
            选择 Gemini 或 OpenAI Responses。API Key 仅保存在本地浏览器。
          </div>
          <el-select v-model="provider" style="width: 100%; margin-bottom: 12px;">
            <el-option label="Gemini" value="gemini" />
            <el-option label="OpenAI (Responses)" value="openai" />
          </el-select>

          <div v-if="provider === 'gemini'">
            <el-input
              v-model="geminiApiKey"
              placeholder="AIza..."
              type="password"
              show-password
            />
          </div>
          <div v-else>
            <el-input
              v-model="openaiApiKey"
              placeholder="sk-..."
              type="password"
              show-password
            />
          </div>

          <div style="margin-top: 15px; text-align: right;">
            <el-button type="primary" @click="saveProviderConfig">保存配置</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>模型参数</span>
          </template>
          <div style="margin-bottom: 10px; font-size: 0.9rem; color: #888;">
            仅影响当前 Provider。
          </div>

          <div v-if="provider === 'gemini'" style="margin-bottom: 12px;">
            <div style="font-size: 0.85rem; color: #666; margin-bottom: 6px;">Gemini 模型</div>
            <el-input v-model="geminiModel" placeholder="gemini-2.5-flash" />
          </div>

          <div v-else style="display: grid; gap: 12px;">
            <div>
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 6px;">OpenAI 模型</div>
              <el-input v-model="openaiModel" placeholder="gpt-5.4" />
            </div>
            <div>
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 6px;">Base URL</div>
              <el-input v-model="openaiBaseUrl" placeholder="https://llmapi.devart.ai" />
            </div>
            <div>
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 6px;">Reasoning Effort</div>
              <el-select v-model="openaiReasoningEffort" style="width: 100%;">
                <el-option label="low" value="low" />
                <el-option label="medium" value="medium" />
                <el-option label="high" value="high" />
                <el-option label="xhigh" value="xhigh" />
              </el-select>
            </div>
          </div>

          <div style="margin-top: 15px; text-align: right;">
            <el-button type="primary" @click="saveModelConfig">保存参数</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-bottom: 20px;">
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

const provider = ref('gemini')
const geminiApiKey = ref('')
const openaiApiKey = ref('')
const geminiModel = ref('gemini-2.5-flash')
const openaiModel = ref('gpt-5.4')
const openaiBaseUrl = ref('https://llmapi.devart.ai')
const openaiReasoningEffort = ref('xhigh')
const acgBgInput = ref('')

const backups = computed(() => store.study_backups)

onMounted(() => {
  provider.value = localStorage.getItem('llm_provider') || 'gemini'
  geminiApiKey.value = localStorage.getItem('gemini_api_key') || ''
  openaiApiKey.value = localStorage.getItem('openai_api_key') || ''
  geminiModel.value = localStorage.getItem('gemini_model') || 'gemini-2.5-flash'
  openaiModel.value = localStorage.getItem('openai_model') || 'gpt-5.4'
  openaiBaseUrl.value = localStorage.getItem('openai_base_url') || 'https://llmapi.devart.ai'
  openaiReasoningEffort.value = localStorage.getItem('openai_reasoning_effort') || 'xhigh'
  acgBgInput.value = localStorage.getItem('custom_acg_bg') || ''
})

const formatTime = (ts) => {
  if (!ts) return '未知时间'
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const saveProviderConfig = () => {
  localStorage.setItem('llm_provider', provider.value)

  const geminiKey = geminiApiKey.value.trim()
  const openaiKey = openaiApiKey.value.trim()

  if (geminiKey) {
    localStorage.setItem('gemini_api_key', geminiKey)
  } else {
    localStorage.removeItem('gemini_api_key')
  }

  if (openaiKey) {
    localStorage.setItem('openai_api_key', openaiKey)
  } else {
    localStorage.removeItem('openai_api_key')
  }

  ElMessage.success('Provider 配置已保存。')
}

const saveModelConfig = () => {
  localStorage.setItem('gemini_model', geminiModel.value.trim() || 'gemini-2.5-flash')
  localStorage.setItem('openai_model', openaiModel.value.trim() || 'gpt-5.4')
  localStorage.setItem('openai_base_url', openaiBaseUrl.value.trim() || 'https://llmapi.devart.ai')
  localStorage.setItem('openai_reasoning_effort', openaiReasoningEffort.value || 'xhigh')
  ElMessage.success('模型参数已保存。')
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
