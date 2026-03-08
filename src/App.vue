<template>
  <el-config-provider>
    <div id="app-container" style="height: 100vh; overflow: hidden;">
      <el-container style="height: 100%; background: transparent;">
        
        <!-- 侧边栏导航 (Element Plus) -->
        <el-aside width="220px" :style="{ backgroundColor: isAcgDark ? 'rgba(20, 15, 25, 0.4)' : '#2c3e50', backdropFilter: isAcgDark ? 'blur(10px)' : 'none', display: 'flex', flexDirection: 'column', borderRight: isAcgDark ? '1px solid rgba(255,126,179,0.1)' : 'none' }">
          <div :style="{ padding: '20px', color: isAcgDark ? '#ff99c4' : 'white', fontWeight: 'bold', textAlign: 'center', fontSize: '1.2rem', borderBottom: isAcgDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #1a252f' }">
            🗻 日语进阶私教
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
            <!-- 修复了 default-active 和 router=true 的配合使用，index 即跳转的 route path -->
            <el-menu-item index="/">
              <span>🎮 训练打卡区</span>
            </el-menu-item>
            <el-menu-item index="/syllabus">
              <span>📚 知识大纲管理</span>
            </el-menu-item>
            <el-menu-item index="/mistakes">
              <span>📓 专属错题集</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <span>⚙️ 全局系统设置</span>
            </el-menu-item>
          </el-menu>

          <div :style="{ padding: '20px', textAlign: 'center', borderTop: isAcgDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #1a252f' }">
             <p :style="{ color: isAcgDark ? '#b3aebd' : '#666', fontSize: '0.8rem', marginBottom: '10px' }">进度状态: 第 {{ store.progress.current_lesson }} 课</p>
             <el-button type="info" plain size="small" @click="exportData" style="width: 100%; margin-bottom: 10px;">
                💾 导出进度
             </el-button>
             <el-button type="success" size="small" @click="$refs.fileInput.click()" style="width: 100%; margin: 0;">
                📂 导入存档
             </el-button>
             <input type="file" ref="fileInput" accept=".json" style="display: none;" @change="importData">
          </div>
        </el-aside>

        <!-- 主内容区 -->
        <el-main style="padding: 0; background: transparent;">
          <el-main class="app-main">
            <router-view />
          </el-main>
        </el-main>
        
      </el-container>

    <!-- 浮动控制面板 -->
    <div class="theme-toggle-fab">
      <el-switch
        v-model="isAcgDark"
        class="ml-2"
        inline-prompt
        style="--el-switch-on-color: #8b5cf6; --el-switch-off-color: #4b5563"
        active-text="🌌 ACG 沉浸"
        inactive-text="🏢 工作伪装"
        @change="toggleTheme"
      />
    </div>
  </div>
</el-config-provider>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/store/mainStore'

const store = useMainStore()
const router = useRouter()
const fileInput = ref(null)
const isAcgDark = ref(false)

const activePath = computed(() => {
    return router?.currentRoute?.value?.path || '/'
})

const toggleTheme = (val) => {
    isAcgDark.value = val;
    // 强制开启 Element Plus 的基础暗黑模式
    document.documentElement.classList.add('dark'); 
    
    if (val) {
        document.documentElement.classList.add('acg-theme');
    } else {
        document.documentElement.classList.remove('acg-theme');
    }
}

const handleKeyDown = (e) => {
    // Alt + D 快捷键切换老干部模式和二次元模式
    if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme(!isAcgDark.value);
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

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('bg-url-changed', applyCustomBg)
    
    // 初始化应用自定义背景
    applyCustomBg()

    const savedTheme = localStorage.getItem('theme_acg_dark')
    if (savedTheme !== null) {
        toggleTheme(savedTheme === 'true')
    } else {
        toggleTheme(true) // 默认开启
    }
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('bg-url-changed', applyCustomBg)
})

watch(isAcgDark, (newVal) => {
    localStorage.setItem('theme_acg_dark', newVal)
})

// Data Sync Ported Logic
const exportData = () => {
    const dataStr = JSON.stringify(store.$state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("进度已导出！");
}

const importData = async (e) => {
    const file = e.target.files[0]
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && data.progress && data.mistakes_book) {
            store.overwriteState(data)
            alert("学习进度恢复成功！");
        } else {
            throw new Error("JSON 格式不正确");
        }
    } catch (err) {
        alert("读取失败: " + err.message);
    }
    e.target.value = ''
}
</script>

<style>
/* 重置全局 margin */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
</style>
