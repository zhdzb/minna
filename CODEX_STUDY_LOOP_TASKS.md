# Codex Study Loop Task Breakdown

更新时间：2026-06-26

本文档把 `CODEX_STUDY_LOOP_DEVELOPMENT.md` 拆成可逐步执行的开发任务。后续每次对话默认完成一个 Step。所有 Step 完成后，本轮 Codex Study Loop 重构完成。

## 执行规则

- 每次只做一个 Step，除非用户明确要求合并。
- 每个 Step 完成后更新本文档状态。
- 涉及代码的 Step 需要运行 `npm run verify`，除非该 Step 明确为文档或纯数据草案。
- 涉及 UI 的 Step 在可行时需要启动本地页面验证。
- 不再要求兼容旧 Dashboard、旧 TrainingEngine、旧 `src/skills/*`。
- 不直接修改用户已有的学习数据，除非该 Step 明确是迁移或 seed 数据生成。

## 状态图例

- `pending`：未开始。
- `in_progress`：正在做。
- `done`：完成。
- `blocked`：被阻塞。

## 总体阶段

- Phase 1：数据协议和 seed 数据。
- Phase 2：本地读写模块和校验。
- Phase 3：Agent 文件工作流。
- Phase 4：Agent Study 页面。
- Phase 5：批改写回和状态更新。
- Phase 6：复习页和整体 Review 页。
- Phase 7：删除旧逻辑和收尾。

## Step 01: 建立 study 目录和 seed 数据

状态：pending

目标：

- 创建新流程的数据目录。
- 提供一套最小可运行 seed 数据。

改动范围：

- `study/index.json`
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `study/daily/`
- `study/reviews/`
- `study/prompts/templates/`
- `study/prompts/generated/`
- `study/context/`
- `study/logs/`

实现要点：

- seed 数据使用当前学习主线：第 7 课基础重建。
- `study/index.json` 指向 latest daily、latest prompt、latest review，可为空但字段必须稳定。
- `agent-events.jsonl` 可以先为空文件或包含 seed 初始化事件。

验收标准：

- 所有 JSON 文件可被 `JSON.parse` 解析。
- 目录结构与开发文档一致。
- 不修改 `data.json`。

## Step 02: 定义 Agent Study schema 校验模块

状态：pending

目标：

- 新增本地 schema 校验工具，防止写入不可解析或字段缺失的数据。

改动范围：

- `src/utils/agentStudySchema.js`
- `tests/agentStudySchema.test.js`

实现要点：

- 校验 `index`、`current`、`mastery`、`reviewQueue`、`promotionRules`、`dailyPacket`、`reviewResult`。
- 先用手写 validator，不引入新依赖。
- validator 返回 normalized object 或抛出明确错误。

验收标准：

- seed JSON 均能通过校验。
- 缺少关键字段时测试失败并给出明确错误。
- `npm run verify` 通过。

## Step 03: 新建 agentStudy 文件读写模块

状态：pending

目标：

- 提供统一的 `study/` 文件读写入口。

改动范围：

- `src/server/agentStudy/fileStore.js`
- `tests/agentStudyFileStore.test.js`

实现要点：

- 支持读取 index、latest daily、latest review。
- 支持保存 daily 草稿。
- 支持提交 daily packet。
- 写入前调用 schema 校验。
- 路径必须限制在项目 `study/` 目录内。

验收标准：

- 可以读取 seed 数据。
- 可以写入 daily packet 副本。
- 不允许路径穿越。
- `npm run verify` 通过。

## Step 04: 新建 event log 工具

状态：pending

目标：

- 统一追加 Agent 和前端事件。

改动范围：

- `src/server/agentStudy/eventLog.js`
- `tests/agentStudyEventLog.test.js`

实现要点：

- 每条事件包含 `event_id`、`time`、`actor`、`event`、`input_files`、`output_files`、`summary`。
- 追加 JSONL，不覆盖历史。
- 提供读取最近 N 条事件的函数。

验收标准：

- 追加多条事件后均可逐行解析。
- 读取最近事件顺序正确。
- `npm run verify` 通过。

## Step 05: 新建 prompt templates

状态：pending

目标：

- 建立稳定的 Codex 操作提示词模板，防止 prompt 漂移。

改动范围：

- `study/prompts/templates/create-daily-packet.md`
- `study/prompts/templates/review-submitted-packet.md`
- `study/prompts/templates/compress-context.md`
- `study/prompts/manifest.json`

实现要点：

- 每个模板必须包含允许读取/写入文件、禁止覆盖历史、schema 要求、event log 要求。
- review 模板必须包含错因标签 taxonomy 和晋级规则。

验收标准：

- 模板可直接复制给 Codex 使用。
- `manifest.json` 可解析。
- 不需要跑 `npm run verify`，除非同时改代码。

## Step 06: 生成 next-agent-context 工具

状态：pending

目标：

- 根据当前 state/index/recent review 生成 `study/context/next-agent-context.md`。

改动范围：

- `src/server/agentStudy/contextWriter.js`
- `tests/agentStudyContextWriter.test.js`
- `study/context/next-agent-context.md`

实现要点：

- 上下文应短、稳定、包含下一步操作。
- 必须列出 Codex 下次应读取的文件。
- 不复制完整 daily/review，只摘要并引用路径。

验收标准：

- 能从 seed 数据生成 context。
- context 包含 latest daily、mastery、review queue 路径。
- `npm run verify` 通过。

## Step 07: 新建本地 agent-study API handlers

状态：pending

目标：

- 提供前端读写 `study/` 的本地 API handler。

改动范围：

- `src/server/agentStudy/routes.js`
- `tests/agentStudyRoutes.test.js`

实现要点：

- `handleGetLatestAgentStudy`
- `handleSaveDailyPacket`
- `handleSubmitDailyPacket`
- `handleGetLatestReview`
- handlers 不依赖 Vite request/response。

验收标准：

- handlers 可单元测试。
- submit 会写 event log。
- `npm run verify` 通过。

## Step 08: 接入 Vite dev API

状态：pending

目标：

- 把本地 API 暴露给前端。

改动范围：

- `vite.config.js`

实现接口：

- `GET /api/agent-study/latest`
- `POST /api/agent-study/daily/save`
- `POST /api/agent-study/daily/submit`
- `GET /api/agent-study/review/latest`

验收标准：

- API 调用能返回 JSON。
- 业务逻辑仍在 `src/server/agentStudy/`。
- `npm run verify` 通过。

## Step 09: 新建 Agent Study 前端数据客户端

状态：pending

目标：

- 前端统一通过客户端访问本地 agent-study API。

改动范围：

- `src/utils/agentStudyClient.js`
- `tests/agentStudyClient.test.js`

实现要点：

- `loadLatestAgentStudy`
- `saveDailyPacket`
- `submitDailyPacket`
- `loadLatestReview`
- 支持注入 `fetchImpl` 以便测试。

验收标准：

- 客户端能处理成功和失败响应。
- `npm run verify` 通过。

## Step 10: 新建 AgentStudyWorkspace 页面骨架

状态：pending

目标：

- 新建主学习页面，不接复杂交互。

改动范围：

- `src/components/AgentStudyWorkspace.vue`
- `src/router/index.js`
- 可能修改 `src/App.vue` 导航入口

实现要点：

- 页面加载 latest daily packet。
- 显示今日计划、状态、任务、学习材料、练习列表。
- 提供加载失败和空状态。

验收标准：

- `/agent-study` 可访问。
- seed daily packet 可渲染。
- `npm run verify` 通过。

## Step 11: 实现 AgentStudyWorkspace 答题草稿

状态：pending

目标：

- 用户可以在 `/agent-study` 输入答案并保存草稿。

改动范围：

- `src/components/AgentStudyWorkspace.vue`

实现要点：

- 支持 `q_fill`、`q_translate`、`q_conversation` 的最小渲染。
- 答案写入 `daily.answers`。
- 保存草稿调用 `/api/agent-study/daily/save`。

验收标准：

- 输入答案后可保存。
- 刷新后能看到保存的答案。
- `npm run verify` 通过。

## Step 12: 实现提交到仓库

状态：pending

目标：

- 用户点击提交后 daily packet 进入 `submitted` 状态。

改动范围：

- `src/components/AgentStudyWorkspace.vue`
- `src/server/agentStudy/routes.js` 如有需要

实现要点：

- 提交时写入 self_assessment。
- 状态从 `answering` 或 `learning` 变为 `submitted`。
- 追加 `session_submitted` 或 `daily_submitted` event。
- 页面显示下一步：复制 review prompt 给 Codex。

验收标准：

- 文件状态变为 `submitted`。
- event log 有提交事件。
- `npm run verify` 通过。

## Step 13: 实现复制批改提示词

状态：pending

目标：

- 前端能展示并复制 generated review prompt。

改动范围：

- `src/components/AgentStudyWorkspace.vue`
- `src/server/agentStudy/fileStore.js` 如需读取 prompt
- `src/server/agentStudy/routes.js` 如需新增 handler

实现要点：

- 页面显示 prompt 文件路径。
- 支持复制 prompt 内容或至少复制路径和操作说明。
- 缺少 prompt 时显示明确提示。

验收标准：

- 用户提交后能获得下一步 Codex 批改提示。
- `npm run verify` 通过。

## Step 14: 定义 review 写回样例

状态：pending

目标：

- 提供一份真实 review 结果样例，用于前端和状态更新开发。

改动范围：

- `study/reviews/YYYY-MM-DD-review.json`
- `study/index.json`
- `study/daily/YYYY-MM-DD.json`

实现要点：

- review 包含 overall、items、mastery_updates、review_queue_updates、promotion_decision。
- daily packet 的 correction 状态更新为 `reviewed`。

验收标准：

- review JSON 可校验。
- `/api/agent-study/review/latest` 可读取。

## Step 15: 展示批改结果

状态：pending

目标：

- `/agent-study` 能展示 latest review。

改动范围：

- `src/components/AgentStudyWorkspace.vue`

实现要点：

- 显示总体正确率、summary、next_focus。
- 按题显示正确/错误、错因标签、解释、参考答案。

验收标准：

- review 样例能正确展示。
- `npm run verify` 通过。

## Step 16: 实现 mastery 更新工具

状态：pending

目标：

- 根据 review 的 `mastery_updates` 更新 `study/state/mastery.json`。

改动范围：

- `src/server/agentStudy/masteryUpdater.js`
- `tests/agentStudyMasteryUpdater.test.js`

实现要点：

- 支持状态升降级。
- 支持 grammar/listening/speaking/reading 分数更新。
- 不允许无 review 证据推进课次。

验收标准：

- 正确更新 mastery。
- 错误输入被拒绝。
- `npm run verify` 通过。

## Step 17: 实现 review queue 更新工具

状态：pending

目标：

- 根据 review 更新间隔复习队列。

改动范围：

- `src/server/agentStudy/reviewQueueUpdater.js`
- `tests/agentStudyReviewQueueUpdater.test.js`

实现要点：

- 错题进入 due 或短间隔复习。
- 连续正确延长 interval。
- 已掌握内容再次错可重新进入队列。

验收标准：

- wrong/correct 两类更新均有测试。
- `npm run verify` 通过。

## Step 18: 实现 review_submitted_packet 工作流工具

状态：pending

目标：

- 将 review、mastery、review queue、current、context、event log 串起来。

改动范围：

- `src/server/agentStudy/reviewWorkflow.js`
- `tests/agentStudyReviewWorkflow.test.js`

实现要点：

- 输入 submitted daily 和 review result。
- 更新 mastery 和 review queue。
- 更新 daily correction 状态。
- 追加 event log。
- 更新 next-agent-context。
- 最后更新 index。

验收标准：

- 工作流按原子写入顺序执行。
- 失败时不更新 index。
- `npm run verify` 通过。

## Step 19: 新建 AgentProgressReview 页面

状态：pending

目标：

- 展示整体学习进度和状态。

改动范围：

- `src/components/AgentProgressReview.vue`
- `src/router/index.js`
- 导航入口

实现要点：

- 显示 current lesson。
- 显示 mastery 状态。
- 显示 review queue 摘要。
- 显示 promotion decision。
- 显示 event log 最近记录。
- 显示 next-agent-context。

验收标准：

- `/agent-progress-review` 可访问。
- seed state 可渲染。
- `npm run verify` 通过。

## Step 20: 新建 AgentReviewDrill 页面

状态：pending

目标：

- 展示复习队列和错题变体练习入口。

改动范围：

- `src/components/AgentReviewDrill.vue`
- `src/router/index.js`
- 导航入口

实现要点：

- 读取 review queue due items。
- 显示语法点、错因、due date。
- 预留答题区域。
- 不需要第一版自动生成新题。

验收标准：

- `/agent-review-drill` 可访问。
- due items 可渲染。
- `npm run verify` 通过。

## Step 21: 支持复习 drill packet

状态：pending

目标：

- 为复习页提供结构化 drill 数据。

改动范围：

- `study/review-drills/`
- `src/utils/agentStudySchema.js`
- `src/server/agentStudy/fileStore.js`
- `src/components/AgentReviewDrill.vue`

实现要点：

- review drill 包含薄弱点说明、变体题、answers。
- 前端可以提交复习答案。

验收标准：

- 能完成一次复习 drill 的保存和提交。
- `npm run verify` 通过。

## Step 22: 实现 compress_context 工具

状态：pending

目标：

- 定期压缩上下文。

改动范围：

- `src/server/agentStudy/contextCompressor.js`
- `tests/agentStudyContextCompressor.test.js`
- `study/context/snapshots/`

实现要点：

- 从 daily/reviews/logs/mastery 生成 snapshot。
- 精简 next-agent-context。
- 追加 event log。

验收标准：

- 能生成一份 snapshot。
- next-agent-context 不包含大量历史全文。
- `npm run verify` 通过。

## Step 23: 迁移 data.json 历史数据

状态：pending

目标：

- 从旧 `data.json` 提取有价值历史，迁移到 `study/`。

改动范围：

- `src/server/agentStudy/migrateLegacyData.js`
- `tests/agentStudyMigration.test.js`
- `study/state/*` seed 数据可更新

实现要点：

- 迁移 current_lesson。
- 迁移 mistakes_book 到 review queue 或 current weak summary。
- 迁移 lesson_stats 到 mastery 参考。
- 原 `data.json` 不被修改。

验收标准：

- 可从当前 data.json 生成 study state。
- `npm run verify` 通过。

## Step 24: 清理旧前端入口

状态：pending

目标：

- 让新三页面成为主入口。

改动范围：

- `src/App.vue`
- `src/router/index.js`
- 可能删除或降级旧组件入口

实现要点：

- 导航只突出 Agent Study、Review Drill、Progress Review。
- 旧 Dashboard/TrainingEngine 不再作为默认入口。

验收标准：

- 应用打开后能进入新流程。
- `npm run verify` 通过。

## Step 25: 删除旧 skills 和前端 LLM 路径

状态：pending

目标：

- 移除不再需要的旧前端 LLM 技能逻辑。

改动范围：

- `src/skills/generateExercise.js`
- `src/skills/evaluateSentence.js`
- `src/utils/llmProvider.js`
- 相关引用组件
- 相关测试

实现要点：

- 确认无新页面依赖这些文件。
- 删除或替换旧引用。
- 若测试依赖旧逻辑，同步移除或改写。

验收标准：

- `rg "skills|llmProvider|GenerateGrammarExerciseSkill|EvaluateSentenceSkill"` 无不合理引用。
- `npm run verify` 通过。

## Step 26: 编码和文档清理

状态：pending

目标：

- 清理乱码文案和过时文档，让新开发入口清晰。

改动范围：

- `README.md`
- `AGENTS.md`
- `CODEX_STUDY_LOOP_DEVELOPMENT.md`
- 需要保留的页面文案

实现要点：

- README 指向新流程。
- AGENTS.md 写入 study 数据硬规则。
- 保留历史文档但标注已过时。

验收标准：

- 新贡献者能从 README/开发文档知道下一步。
- `npm run verify` 通过。

## Step 27: 端到端本地闭环验证

状态：pending

目标：

- 验证完整流程。

流程：

1. 加载 `/agent-study`。
2. 完成 seed daily packet。
3. 保存草稿。
4. 提交答案。
5. 复制 review prompt。
6. 写入 review 样例或让 Codex 执行 review。
7. 刷新页面展示 review。
8. 查看 progress review 状态变化。

验收标准：

- 文件状态流完整。
- event log 完整。
- next-agent-context 更新。
- `npm run verify` 通过。

## 完成定义

所有 Step 状态均为 `done`，且 Step 27 通过，即本轮开发完成。

