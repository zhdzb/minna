# 随身日语私教 App 开发指南 (Agent Instructions)

这个文件是为 AI 智能助手准备的项目全局上下文与开发准则。在后续的开发过程中，请严格遵循以下设定。

## 一、 项目背景与技术栈选型
本项目旨在为日语 N5 学习者（以《大家的日语》教材为核心纲领，以 JLPT 考级和赴日工作为导向）开发一款**智能辅助伴读 Web App**。

- **前端架构**：纯净的 HTML / JS (Vanilla or ES6) / CSS，或者极轻量的无打包框架（如直接在浏览器引入 React/Vue 的 CDN 版本），**禁止使用需要复杂 Node.js 编译构建（如 Next.js/Vite 复杂模版）的重型框架**。
- **UI 设计原则**：现代化、响应式。使用大面积留白与柔和的色彩体系（如日本传统色系）。
- **数据持久化与跨端**：
  - 数据源统一读写：本地的 `data.json`。
  - 用户状态：保存在浏览器 `LocalStorage` 中以防刷新丢失。
  - 进度同步机制：依赖 Git 的手动/脚本 Commit & Push。
- **AI 后端服务 (Serverless)**：所有题目生成与打分，直接在前端 JS 中调用 **Google Gemini API**。

## 二、 核心开发流与文件参考
本项目的所有核心业务逻辑、功能特性约束（Edge Cases）和 API Prompt 设计原理，均已在以下两个文档中定义完毕：
1. **👉 [产品设计方案](./product_design.md)**：包含记忆导航、多级题型（Level 1-3）、双轨错题本机制以及“影子跟读”等进阶功能的定义。
2. **👉 [技术实现与 API 设计](./implementation_plan.md)**：包含 `data.json` 数据结构、Gemini 请求的 Batching 策略、Token 节省方案、以及关键的“防脱轨上下文注入 Payload 设计”。

## 三、 给 AI Agent (Antigravity) 的核心行为指令

### 1. 严格控制权限请求 (Auto-Run 原则)
用户明确表示：**不要频繁弹出不需要的终端权限询问，极度影响效率**。
在执行任何终端命令（`run_command`）时，只要你判定该命令是**安全且无破坏性**的（例如：`mkdir`、`npm install` 常规开源库、新建文件、启动本地服务 `npx http-server` 等），你**必须强行设置 `SafeToAutoRun: true`**，让命令自动在后台静默执行，除非面临格式化硬盘或删除大段不可逆代码的致命操作。对于本地文件的读写修改（`write_to_file`、`replace_file_content`），请果断并自动执行，不需要询问。

### 2. 严控 API 消耗与“幻觉”
- 每次写跟 Gemini 通信的 JS `fetch` 代码时，切记**严禁传入历史对话记录**。每一轮请求都是一个无状态的原子操作，将进度和规则放入 `systemInstruction`。
- 实现防抖预缓存：进入某课时先请求 10 道题放入前端状态中。切忌给按钮绑定没必要的高频 API 请求。
- 支持罗马音兜底，请优先在项目引入 `wanakana.js`。

### 3. Git 工作流辅助
由于项目依赖 Git 来做进度云同步，每次系统有重大里程碑时，你可以主动帮用户生成能够同步代码和 `data.json` 的 powershell 或 bash 脚本供用户一键执行。

### 4. 测试驱动开发 (Test-Driven Development - TDD)
对于所有的核心逻辑模块（如状态加载/保存机制、API 解析器、罗马音转写等），开发流程必须是：
**先写测试用例 (Jest)** -> 再写实现代码 -> 运行命令行校验测试通过。
我们已为此项目通过 npm 初始化了 Jest 单元测试环境。

### 5. 引入 "Skills 模块化" 架构思想
不要把对 Gemini API 的请求写成一坨巨大的“万能 Prompt”。我们在系统级别引入 **"Skills 技能分发"** 的设计思想：
将 AI 能力拆解为多个独立的 JS 函数/类（Skills）。例如：
- `GenerateGrammarExerciseSkill`: 专注负责向 AI 发送规则并抽取填空/造句题。
- `EvaluateSentenceSkill`: 专注负责批改用户的回答并返回结构化的纠错信息。
这样每一个 Skill 的职责明确、Prompt 简短精炼，最大程度避免幻觉和上下文污染。

---
> “在理解了以上约束后，请从 task.md 的第二阶段开始，为我搭建这个极简却充满魔力的 Web App 吧！”
