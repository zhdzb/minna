# 用户的《大家的日语》随身私教 App 开发任务清单

- [x] 1. **产品与架构规划** (PLANNING)
  - [x] 1.1 核心需求分析与产品功能定位
  - [x] 1.2 技术方案选型 (纯前端 + LocalStorage + Gemini API + Git 同步)
  - [x] 1.3 核心数据结构 `data.json` 设计
  - [x] 1.4 API Prompt 策略设计 (批量出题与批改)
  - [x] 1.5 进阶功能、边界情况处理与 API 优化策略
- [x] 2. **前端基础框架与 TDD 测试环境搭建** (EXECUTION)
  - [x] 2.1 初始化 npm 项目结构，并安装 `jest` 测试框架
  - [x] 2.2 引入 `WanaKana.js` 实现罗马音自动转假名
  - [x] 2.3 设计界面 UI (首页进度看板、做题区、解析与错题本区)
- [x] 3. **核心数据与状态管理逻辑 (先写测试用例)** (EXECUTION)
  - [x] 3.1 [测试驱动] 实现 `data.json` 的本地读取与解析 (LocalStorage 封装)
  - [x] 3.2 实现做题进度的更新逻辑
  - [x] 3.3 实现错题本的自动添加与手动收藏逻辑
  - [x] 3.4 实现进度数据的本地文件下载/保存功能 (用于 Git 同步)
- [x] 4. **AI 核心交互模块对接 (Skills 模块化思想)** (EXECUTION)
  - [x] 4.1 封装对 Google Gemini API 的基础网络请求 (使用用户的 API Key)
  - [x] 4.2 [API Skill 1] 开发 `GenerateGrammarExerciseSkill` (动态出题能力)
  - [x] 4.3 [API Skill 2] 开发 `EvaluateSentenceSkill` (智能批改造句能力)
- [x] 5. **产品体验打磨与系统测试** (VERIFICATION)
  - [x] 5.1 测试 Level 1 填空题与 Level 2 造句题的出题合理性
  - [x] 5.2 测试罗马音输入的丝滑度与标点容错
  - [x] 5.3 测试回答错误后的纠错精度与错题记录
  - [x] 5.4 模拟 Git 同步流程，确保 `data.json` 数据不丢失

---

## Phase 2: Vue 3 架构重构与深度大纲引擎
- [x] 6. **架构大重构 (Vue 3 + Vite)** (EXECUTION)
  - [x] 6.1 使用 Vue 3 初始化工程结构，将老前端平滑迁移至组件化开发体系
  - [x] 6.2 迁移并优化现有的 `LocalState`、核心 Skills 和测试用例
  - [x] 6.3 重新实现组件化的界面 (导航、进度、控制台、出题卡片)
- [x] 7. **深度《大日》知识大纲系统 (Syllabus Engine)** (PLANNING & EXECUTION)
  - [x] 7.1 **调研与构建出题类型字典** (定义基础语法、职场对话、文化拓展等题型集)
  - [x] 7.2 **构建单课多维知识图谱**：设计并预置基础课时大纲，包含课本显性语法点与隐性日语知识（如发音规则、职场文化）
  - [x] 7.3 将大纲数据持久化在 `src/assets/syllabus.json` 中，并在 UI 提供可视化的增删改查页面
- [x] 8. **题控台与细粒度题型流打通** (EXECUTION)
  - [x] 8.1 实现按“题型”为单位的分步答题与细粒度进度存储策略
  - [x] 8.2 升级 GenerateSkill 动态出题引擎：支持注入特定题型、指定知识点、出题数量与发散难度
  - [x] 8.3 开发出题控制台：允许用户手动调节“难度梯次”及输入“定制要求 (Prompt)”
- [x] 9. **强化加练与辅助体验提升** (EXECUTION)
  - [x] 9.1 实现【弱项加练】：在批改报告中暴露出特定语法点的“再来一组”重拨按钮
  - [x] 9.2 [架构建议补充] 预设 "职场商务场景 (Keigo)" 等快捷 Tag，一键无缝绑定到自定义 Prompt 中
  - [x] 9.3 [体验建议补充] 结合浏览器原生 Web Speech API，为造句提供免费的自动语音朗读 (强化听感)
- [x] 10. **二期测试验证与部署** (VERIFICATION)
  - [x] 10.1 测试 Vue3 架构下各种新动态题引擎的容错性，补充单元测试文件

---

## Phase 3: 全局数据深化、组件化解耦与 Element Plus 引擎
- [x] 11. **数据与持久化清洗** (EXECUTION)
  - [x] 11.1 清理 `mainStore.js` 中的旧版本 `data.json` 兼容代码，精简架构
  - [x] 11.2 将 `TrainingEngine` 中控制生成、题目列表、用户答案等局部状态上浮至 `Pinia` 中，确保跨路由跳转 (Router) 时生成请求不被打断、进度不丢失
- [x] 12. **引入第三方工业级 UI (Element Plus)** (EXECUTION)
  - [x] 12.1 引进 `Element Plus` 构建更现代、高效美观的用户界面
  - [x] 12.2 重构导航器并正式引入 `vue-router` 实现真 SPA 跳转
- [x] 13. **高级题型管理与大纲拓展 (Type Engine)** (EXECUTION)
  - [x] 13.1 抽离题型配置字典 (如 `types.json`)，支持题库种系的拓展
  - [x] 13.2 在大纲/设置页面增加 【题型管理集合 CRUD】，设定每课可用的子集
- [x] 14. **出题流转与 UI 改造** (EXECUTION)
  - [x] 14.1 训练设置：新增【生成题目数量】滑动条/输入框接口传递设定
  - [x] 14.2 训练过程：废弃强制的单题“上一题/下一题”，增加【题目网格定位器】，点击实时直达任一题目
  - [x] 14.3 Vocab Hints 生词卡片：增加假名及日语的模糊遮罩遮挡功能，强调靠回忆默写，点击或 hover 才会暴露提示
- [x] 15. **错题本系统重构** (EXECUTION)
  - [x] 15.1 解锁被禁用的菜单项 `/mistakes`
  - [x] 15.2 开发 `MistakesBook.vue` 读取 `Pinia` 状态并展示包含错题清仓机制的交互表格
- [x] 15.5 **系统大纲扩容 (Syllabus Expansion)** (EXECUTION)
  - [x] 15.5.1 在 `syllabus.json` 中完整填入第 4 课至第 10 课的详细语法点
  - [x] 15.5.2 为每课补充独家的《隐性感悟 / 职场语感 (Hidden Knowledge)》，引导 AI 出题

---

## Phase 4: 私人定制视听体验与 ACG 文化聚合
- [x] 16. **全局 ACG 暗黑主题与一键伪装切换** (UI/UX)
  - [x] 16.1 设计一套带有二次元/Galgame风格的柔和暗色系主题 (替换原本的基础色和修正不对齐的Tag/Red Button)
  - [x] 16.2 增加全局的一键“工作伪装/常规”暗色模式切换按钮及快捷键 (如 `Alt + D`)
- [x] 17. **二次元名台词中日双语展板** (API Integration) - **(用户授权跳过：因无原生双语API，取消此非核心功能)**
  - [~] 17.1 开发 `GenerateQuoteSkill`，每次随机抽取经典番剧/Galgame名言
  - [~] 17.2 在 Dashboard 显眼渲染名言卡片
- [x] 18. **浏览器原生语音功能深度外露** (UX Enhancement)
  - [x] 18.1 在更多场景下（如造句练习过程、错题本中）提供点击发声的 `playAudio` 接口暴露
- [x] 19. **文档同步机制** (MAINTENANCE)
  - [x] 19.1 完成代码后，将云端大脑的所有需求文档覆盖回项目的物理目录

---

## Phase 5: 开源发布准备与全局设置中心
- [x] 20. **开源剥离与环境配置** (REFACTOR)
  - [x] 20.1 彻底移除代码中的硬编码 `API_KEY`，修改 `config.js` 改为从 `localStorage` 回退读取
  - [x] 20.2 将 `config.js` 移出 `.gitignore`，让外部开源可见架构
  - [x] 20.3 撰写标准的开源 `README.md`，指导 Github 用户如何填入自己的 Gemini Key 并无缝运行
- [x] 21. **全局设置面板 (Settings View)** (UI/UX)
  - [x] 21.1 新增 `/settings` 路由和 `Settings.vue` 视图界面
  - [x] 21.2 在界面提供 Gemini API Key 的本地录入与保存口
  - [x] 21.3 提供 ACG 暗黑主题下的**自定义壁纸 (Custom BG URL)** 配置口，通过 Pinia 下发到根节点
- [x] 22. **系统大纲扩容 阶段二 (Syllabus Expansion)** (EXECUTION)
  - [x] 22.1 在 `syllabus.json` 中继续将大纲数据填充至第 20 课，并补充大量易混淆隐性知识点
