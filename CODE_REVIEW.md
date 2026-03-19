# Minna 项目代码审查报告

## 项目概述

这是一个基于 **Vue 3 + Vite + Pinia + Element Plus** 的日语学习应用，使用 Google Gemini API 进行智能出题和批改。

---

## 一、稳定性问题

### 🔴 高优先级

#### 1. API 调用无超时控制
**位置**: `src/skills/generateExercise.js:87`, `src/skills/evaluateSentence.js:48`

```javascript
// 当前：无超时，用户可能无限等待
const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, { ... });
```

**风险**: 网络不稳定时用户界面会卡死，无任何反馈。

**建议修改**:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
try {
    const response = await fetch(url, { ...options, signal: controller.signal });
} finally {
    clearTimeout(timeoutId);
}
```

---

#### 2. API 响应结构未充分验证
**位置**: `src/skills/generateExercise.js:110`, `src/skills/evaluateSentence.js:70`

```javascript
// 直接访问深层属性，若结构异常会崩溃
const textResponse = data.candidates[0].content.parts[0].text;
```

**风险**: Gemini API 返回格式变化或错误时，应用会崩溃。

**建议修改**:
```javascript
const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
if (!textResponse) {
    throw new Error("Invalid API response structure");
}
```

---

#### 3. JSON 解析无保护
**位置**: `src/skills/generateExercise.js:115`, `src/skills/evaluateSentence.js:73`

```javascript
return JSON.parse(cleanJsonStr); // 若 AI 返回非 JSON 会崩溃
```

**建议修改**:
```javascript
try {
    return JSON.parse(cleanJsonStr);
} catch (e) {
    console.error("Failed to parse AI response:", cleanJsonStr.substring(0, 200));
    throw new Error("AI 返回的数据格式异常，请重试");
}
```

---

#### 4. 存储 Key 不一致导致数据隔离
**位置**: `src/utils/localState.js:6` vs `src/store/mainStore.js:52`

```javascript
// localState.js
static STORAGE_KEY = 'minna_app_data';

// mainStore.js
localStorage.getItem('minna_no_nihongo_data')
```

**风险**: 两套存储系统，数据不同步，用户进度可能丢失。

**建议**: 统一使用一个 Storage Key，删除 `LocalState` 类，完全使用 Pinia Store。

---

### 🟡 中优先级

#### 5. 无 API 重试机制
网络波动会导致用户需要手动重新操作。

**建议修改**:
```javascript
async fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            if (res.status >= 400 && res.status < 500) break; // 客户端错误不重试
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}
```

---

#### 6. Store 状态缺少防抖保护
**位置**: `src/store/mainStore.js:65-78`

`saveState()` 每次调用都写入 LocalStorage 并发起 fetch。高频操作时会产生大量写入和网络请求。

**建议修改**:
```javascript
import { debounce } from 'lodash-es';

// 在 actions 中
saveState: debounce(function() {
    this.meta.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
    fetch('/api/save-progress', { ... });
}, 500)
```

---

## 二、实用性问题

### 🔴 高优先级

#### 1. 遗留代码与 Vue 架构共存
`src/app.js` 是一个独立的 vanilla JS 控制器，与 Vue 3 + Pinia 架构完全脱节。

**问题**:
- 引用的 `GenerateGrammarExerciseSkill`、`LocalState` 与 Vue 组件中使用的版本重复实例化
- 代码维护困难，两套逻辑容易产生 bug

**建议**: 删除 `app.js`，将所有逻辑统一到 Vue 组件和 Pinia Store。

---

#### 2. AI 返回数据结构不可预测
**位置**: `src/skills/generateExercise.js:94`

AI 可能返回空数组、缺少关键字段（如 `id`、`type`、`answer`）的练习题。

**建议修改**:
```javascript
const validateExercise = (ex) => {
    return ex && ex.id && ex.type && (ex.question || ex.chinese_prompt);
};

async generate(context) {
    // ...
    const result = JSON.parse(cleanJsonStr);
    const validExercises = (result.exercises || []).filter(validateExercise);

    if (validExercises.length === 0) {
        throw new Error("AI 未生成有效题目，请重试");
    }

    return { exercises: validExercises };
}
```

---

#### 3. 批改结果与题目 ID 匹配脆弱
**位置**: `src/components/TrainingEngine.vue:358-360`

若 AI 返回的 ID 与题目 ID 类型不一致（数字 vs 字符串），会导致匹配失败。

**建议修改**:
```javascript
// 统一转换为字符串进行匹配
const gradeMap = new Map(
    res.map(item => [String(item.id), item])
);

// 在使用时也统一转换
const grade = gradeMap.get(String(exercise.id));
```

---

### 🟡 中优先级

#### 4. Syllabus 修改未持久化
**位置**: `src/components/SyllabusManager.vue:136-142`

`saveSyllabusOverride` 仅显示 Toast 提醒，实际未保存修改。刷新页面后所有大纲修改丢失。

**建议**: 添加 LocalStorage 持久化或同步到 data.json。

---

#### 5. API Key 有效性未验证
**位置**: `src/skills/generateExercise.js:83`

用户输入的 API Key 直接使用，无任何格式校验。

**建议修改**:
```javascript
// 在 Settings.vue 保存 API Key 时
function validateApiKey(key) {
    if (!key || key.length < 10) {
        return { valid: false, message: "API Key 长度不足" };
    }
    if (!key.startsWith('AIza')) {
        return { valid: false, message: "API Key 格式不正确，应以 AIza 开头" };
    }
    return { valid: true };
}
```

---

## 三、架构和可维护性问题

### 🔴 高优先级

#### 1. 配置管理混乱
API Key 通过三种方式获取：
- `window.localStorage.getItem('gemini_api_key')` (`config.js`)
- `window.CONFIG.GEMINI_API_KEY` (`TrainingEngine.vue`)
- 直接 `localStorage.getItem('gemini_api_key')` (`Settings.vue`)

**建议**: 创建统一的配置 Store：

```javascript
// src/store/configStore.js
export const useConfigStore = defineStore('config', {
    state: () => ({
        geminiApiKey: localStorage.getItem('gemini_api_key') || ''
    }),
    actions: {
        setApiKey(key) {
            this.geminiApiKey = key;
            localStorage.setItem('gemini_api_key', key);
        }
    }
});
```

---

#### 2. 全局变量污染
**位置**: `config.js:18`, `src/utils/localState.js:89`, `src/utils/dataSync.js:51`

```javascript
window.CONFIG = CONFIG;
window.LocalState = LocalState;
window.DataSync = DataSync;
```

**风险**: 污染全局命名空间，可能与第三方库冲突。

**建议**: 使用 ES Module 导出，避免挂载到 window 对象。

---

### 🟡 中优先级

#### 3. 组件职责不清晰
`TrainingEngine.vue` 文件过大（约 500 行），包含了：
- 题目渲染逻辑
- API 调用逻辑
- 状态管理逻辑
- UI 交互逻辑

**建议**: 拆分为：
- `TrainingEngine.vue` - 主控制器
- `QuestionCard.vue` - 题目渲染组件
- `useTraining.ts` - 训练逻辑 composable
- `useGeminiApi.ts` - API 调用逻辑

---

## 四、安全问题

### 🔴 高优先级

#### 1. API Key 暴露在客户端代码中
**位置**: 整个项目架构

当前架构将 Gemini API Key 存储在浏览器 LocalStorage 中，任何人都可以通过开发者工具获取。

**风险**:
- API Key 可能被滥用
- 用户费用风险

**建议**:
- **短期**: 添加使用量提示，让用户知道自己的 API Key 只用于自己的请求
- **长期**: 考虑添加后端代理层，API Key 存储在服务端

---

#### 2. Vite 开发服务器的文件写入接口
**位置**: `vite.config.js:11-30`

```javascript
server.middlewares.use('/api/save-progress', (req, res) => {
    // 直接写入文件系统
    fs.writeFileSync(path.resolve(__dirname, 'data.json'), body, 'utf8');
});
```

**风险**: 在开发环境中，任何人都可以通过 POST 请求写入任意内容到 data.json。

**建议**: 添加请求验证，或限制只在本地开发时启用。

---

### 🟡 中优先级

#### 3. 用户输入未做 XSS 过滤
**位置**: `src/components/TrainingEngine.vue` 中渲染用户答案

```javascript
html += `<div ...>${userAnswers[ex.id] || '-'}</div>`;
```

**建议**: 使用 Vue 的模板语法或 `v-html` 时配合 DOMPurify 进行过滤。

---

## 五、修改建议优先级汇总

| 优先级 | 问题 | 影响 | 工作量 |
|--------|------|------|--------|
| 🔴 P0 | API 调用无超时控制 | 用户体验严重受损 | 小 |
| 🔴 P0 | API 响应结构未验证 | 应用崩溃 | 小 |
| 🔴 P0 | JSON 解析无保护 | 应用崩溃 | 小 |
| 🔴 P0 | 存储 Key 不一致 | 数据丢失 | 中 |
| 🔴 P0 | 遗留代码与 Vue 共存 | 维护困难、bug 多 | 大 |
| 🔴 P1 | AI 返回数据不可预测 | 功能异常 | 中 |
| 🔴 P1 | 配置管理混乱 | 维护困难 | 中 |
| 🟡 P2 | 无 API 重试机制 | 用户体验 | 中 |
| 🟡 P2 | Store 状态无防抖 | 性能问题 | 小 |
| 🟡 P2 | API Key 客户端暴露 | 安全风险 | 大 |
| 🟡 P2 | 用户输入无 XSS 过滤 | 安全风险 | 小 |

---

## 六、快速修复清单

### 第一阶段（立即修复，1-2 天）

1. 为 API 调用添加超时控制
2. 添加 API 响应结构验证
3. 为 JSON 解析添加 try-catch
4. 统一 LocalStorage Key

### 第二阶段（短期修复，3-5 天）

1. 删除 `app.js`，统一使用 Vue 架构
2. 创建统一的配置 Store
3. 添加 AI 返回数据验证层
4. 添加 API 重试机制

### 第三阶段（中期优化，1-2 周）

1. 拆分大型组件
2. 添加用户输入 XSS 过滤
3. 考虑后端代理方案
