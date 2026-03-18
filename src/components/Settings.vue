<template>
  <div>
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div style="font-size: 1.2rem; font-weight: bold;">
          ⚙️ 系统全局设置中心 (Settings)
        </div>
      </template>
      <p style="color: #666; font-size: 0.9rem;">
        您可在此处配置驱动私教的核心引擎密钥与您的独家二次元展现形式。这些数据强制保存在您的本地浏览器中，绝不上传任何第三方。
      </p>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>🔑 核心 AI 驱动引擎 (Gemini API)</span>
            </div>
          </template>
          <div style="margin-bottom: 15px; font-size: 0.9rem; color: #888;">
            本系统由 Google Gemini 2.5 系列模型驱动。请输入您的免费 API Key，我们将用您的 Key 直接通过浏览器前端向 Google 发起请求。
          </div>
          <el-input 
             v-model="apiKeyInput" 
             placeholder="如：AIzaSy..." 
             type="password"
             show-password
          />
          <div style="margin-top: 15px; text-align: right;">
             <el-button type="primary" @click="saveApiKey">保存 API 密钥</el-button>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>🖼️ ACG 模式个性化壁纸 (Custom BG)</span>
            </div>
          </template>
          <div style="margin-bottom: 15px; font-size: 0.9rem; color: #888;">
            当您通过 <code>Alt + D</code> 切换至 ACG 沉浸模式时，背景将展示下面的图片 URL。您可以从 P站 或其它图床直链引用。留空则使用默认壁纸。
          </div>
          <el-input 
             v-model="acgBgInput" 
             placeholder="https://example.com/anime.png (留空恢复默认)" 
             clearable
          />
          <div style="margin-top: 15px; text-align: right;">
             <el-button type="primary" @click="saveBgUrl">应用自定义壁纸</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const apiKeyInput = ref('')
const acgBgInput = ref('')

onMounted(() => {
    apiKeyInput.value = localStorage.getItem('gemini_api_key') || ''
    acgBgInput.value = localStorage.getItem('custom_acg_bg') || ''
})

const saveApiKey = () => {
    if (apiKeyInput.value.trim() !== '') {
        localStorage.setItem('gemini_api_key', apiKeyInput.value.trim())
        ElMessage.success('Gemini API 密钥已强绑定在本地浏览器中！')
    } else {
        localStorage.removeItem('gemini_api_key')
        ElMessage.warning('API 密钥已清除，您将无法使用智能出题与批改服务。')
    }
}

const saveBgUrl = () => {
    localStorage.setItem('custom_acg_bg', acgBgInput.value.trim())
    // 派发事件让 App.vue 重新加载背景，或者由于是页面级别重新刷也可以
    // 这里我们抛出一个自定义事件，让监听的组件去切换，不过最简单的就是直接 window.dispatchEvent
    window.dispatchEvent(new Event('bg-url-changed'))
    ElMessage.success('痛板壁纸 URL 已缓存！(如果没有生效可刷新页面)')
}
</script>
