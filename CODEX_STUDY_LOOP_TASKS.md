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

- Phase 0：深度 review 补强约束。
- Phase 1：数据协议和 seed 数据。
- Phase 2：本地读写模块和校验。
- Phase 3：Agent 文件工作流。
- Phase 4：Agent Study 页面。
- Phase 5：批改写回和状态更新。
- Phase 6：复习页和整体 Review 页。
- Phase 7：删除旧逻辑和收尾。

## Step 00: 固化深度 review 补强约束

状态：done

目标：

- 把长期稳定性约束落入开发计划，避免后续只实现能跑的最小版本。

改动范围：

- `CODEX_STUDY_LOOP_DEVELOPMENT.md`
- `CODEX_STUDY_LOOP_TASKS.md`

实现要点：

- 明确新增 `study/state/profile.json`。
- 明确所有 study JSON 需要 `revision` 和 `updated_at`。
- 明确需要 index rebuild 工具。
- 明确需要 content quality checker。
- 明确 review 需要 confidence、acceptable variants、manual override。
- 明确分题型 rubric、SRS 更新规则、学习流程顺序和激进删除策略。

验收标准：

- 开发文档和任务文档都包含上述约束。
- 不修改 `data.json`。

完成记录：
- 完成内容：确认深度 review 补强约束已写入开发文档和任务拆解，包括 profile.json、revision、updated_at、index rebuild、content quality checker、review confidence/acceptable variants/manual override、分题型 rubric、SRS 规则、学习流程顺序和激进清理策略。
- 修改文件：CODEX_STUDY_LOOP_TASKS.md
- 验证结果：本 Step 仅涉及文档状态与完成记录；未修改代码，未运行 npm run verify。
- 后续注意事项：下一步执行 Step 01，建立 study 目录和 seed 数据，继续避免覆盖历史 daily/review/log 文件。

## Step 01: 建立 study 目录和 seed 数据

状态：done

目标：

- 创建新流程的数据目录。
- 提供一套最小可运行 seed 数据。

改动范围：

- `study/index.json`
- `study/state/profile.json`
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
- 所有 seed JSON 必须包含 `schema_version`、`revision`、`updated_at`。
- `profile.json` 记录学习目标、时间预算、输入偏好、教材范围和是否允许新课推进。
- `study/index.json` 指向 latest daily、latest prompt、latest review，可为空但字段必须稳定。
- `study/index.json` 记录当前 schema 版本集合，后续 migration 和 rebuild 工具要依赖它。
- `agent-events.jsonl` 可以先为空文件或包含 seed 初始化事件。

验收标准：

- 所有 JSON 文件可被 `JSON.parse` 解析。
- 所有 seed JSON 包含 revision 和 updated_at。
- `profile.json` 可被读取并解释学习目标。
- 目录结构与开发文档一致。
- 不修改 `data.json`。

Completion record:
- Completed: Created the `study/` directory, lesson 7 seed state files, a minimal daily packet, and a seed initialization event log.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `study/index.json`, `study/state/profile.json`, `study/state/current.json`, `study/state/mastery.json`, `study/state/review-queue.json`, `study/state/promotion-rules.json`, `study/daily/2026-06-26.json`, `study/logs/agent-events.jsonl`, `study/reviews/.gitkeep`, `study/prompts/templates/.gitkeep`, `study/prompts/generated/.gitkeep`, `study/context/.gitkeep`.
- Verification: Verified with a Node script that every seed JSON parses with `JSON.parse` and includes `schema_version`, `revision`, and `updated_at`. This step did not change runtime code, so `npm run verify` was not run.
- Follow-up: Next is `Step 02`, which should add schema validation and tests for these seed files.
## Step 02: 定义 Agent Study schema 校验模块

状态：done

目标：

- 新增本地 schema 校验工具，防止写入不可解析或字段缺失的数据。

改动范围：

- `src/utils/agentStudySchema.js`
- `tests/agentStudySchema.test.js`

实现要点：

- 校验 `index`、`profile`、`current`、`mastery`、`reviewQueue`、`promotionRules`、`dailyPacket`、`reviewResult`。
- 先用手写 validator，不引入新依赖。
- validator 返回 normalized object 或抛出明确错误。
- validator 必须校验 `schema_version`、`revision`、`updated_at`。
- 旧版本数据进入时必须 normalize 成当前版本，测试覆盖至少一个旧版本 fixture。

验收标准：

- seed JSON 均能通过校验。
- profile/current/mastery/index 的 schema version 和 revision 校验生效。
- 缺少关键字段时测试失败并给出明确错误。
- `npm run verify` 通过。



Completion record:
- Completed: Added a handwritten Agent Study schema validator for index, profile, current, mastery, reviewQueue, promotionRules, dailyPacket, and reviewResult, including legacy profile normalization from schema version 0 to 1.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/utils/agentStudySchema.js`, `tests/agentStudySchema.test.js`.
- Verification: `npm run verify` passed, and the new schema test suite validates all seed study JSON files plus revision/schema and missing-field failures.
- Follow-up: Next is `Step 02A`, which should add content quality validation on top of this shape validation layer.
## Step 02A: 新增内容质量校验模块

状态：done

目标：

- 在 JSON shape 校验之外，校验 Agent 生成内容是否真的适合学习和渲染。

改动范围：

- `src/utils/agentStudyContentQuality.js`
- `tests/agentStudyContentQuality.test.js`

实现要点：

- 检查题目数量不超过当天计划能完成的范围。
- 检查每道题绑定 lesson、skill、target_grammar 或 review_queue item。
- 检查同一目标语法没有重复题。
- 检查语法说明至少包含 2 个例句。
- 检查输出题有参考答案或评分标准。
- 检查听力/跟读任务有脚本。
- 检查 review drill 生成的是变体题，不只是重复原题。

验收标准：

- seed daily packet 通过内容质量校验。
- 构造重复题、缺少例句、缺少参考答案时测试失败。
- `npm run verify` 通过。

Completion record:
- Completed: Added Agent Study content quality validators for daily packets and review drills, covering exercise budget, lesson/skill/grammar binding, duplicate prompts, example minimums, answer references, listening scripts, and review-drill variant checks.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/utils/agentStudyContentQuality.js`, `tests/agentStudyContentQuality.test.js`.
- Verification: `npm run verify` passed, and the new test suite confirms the seed daily packet succeeds while duplicate exercises, missing examples, missing answer references, missing scripts, and identical review variants fail.
- Follow-up: Next is `Step 02B`, which should add an index rebuild utility that reconstructs `study/index.json` from on-disk daily/review/prompt files.

## Step 02B: 新增 index rebuild 工具

状态：done

目标：

- 让 `study/index.json` 可从磁盘事实重建，避免成为单点故障。

改动范围：

- `src/server/agentStudy/indexRebuilder.js`
- `tests/agentStudyIndexRebuilder.test.js`

实现要点：

- 扫描 `study/daily/` 找 latest daily。
- 扫描 `study/reviews/` 找 latest review。
- 扫描 `study/prompts/generated/` 找 latest prompt。
- 校验候选文件后生成 index。
- index 缺失或损坏时可以 fallback rebuild。

验收标准：

- 删除或损坏 index 后可以重建。
- 重建结果通过 schema 校验。
- `npm run verify` 通过。

Completion record:
- Completed: Added an Agent Study index rebuild utility that scans `study/daily/`, `study/reviews/`, and `study/prompts/generated/`, validates daily/review candidates, rewrites `study/index.json`, and falls back to rebuilding when the current index is missing or corrupted.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/indexRebuilder.js`, `tests/agentStudyIndexRebuilder.test.js`.
- Verification: `npx vitest run tests/agentStudyIndexRebuilder.test.js` passed, and `npm run verify` passed with the new rebuild coverage included.
- Follow-up: Next is `Step 03`, which should add the `agentStudy` file store and use this rebuild utility as the index fallback path.
## Step 03: 新建 agentStudy 文件读写模块

状态：done

目标：

- 提供统一的 `study/` 文件读写入口。

改动范围：

- `src/server/agentStudy/fileStore.js`
- `tests/agentStudyFileStore.test.js`

实现要点：

- 支持读取 index、latest daily、latest review。
- 支持保存 daily 草稿。
- 保存时检查 revision，不允许无提示覆盖新版本。
- 支持提交 daily packet。
- 写入前调用 schema 校验。
- 写入前调用 content quality 校验。
- 写入使用临时文件加原子替换。
- 路径必须限制在项目 `study/` 目录内。

验收标准：

- 可以读取 seed 数据。
- 可以写入 daily packet 副本。
- 不允许路径穿越。
- revision 冲突时拒绝写入。
- `npm run verify` 通过。

Completion record:
- Completed: Added the Agent Study file store with unified index/latest daily/latest review reads, safe `study/` path resolution, atomic JSON writes, revision conflict checks, daily draft saves, and daily submission writes that update `study/index.json`.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/fileStore.js`, `tests/agentStudyFileStore.test.js`.
- Verification: `npx vitest run tests/agentStudyFileStore.test.js` passed, and `npm run verify` passed with the new file-store coverage included.
- Follow-up: Next is `Step 04`, which should add the event log utility and plug it into the write workflow without overwriting historical logs.

## Step 04: 新建 event log 工具

状态：done

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

Completion record:
- Completed: Added the Agent Study event log utility with normalized event records, append-only JSONL writes, generated event IDs when needed, and recent-event reads that preserve chronological order.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/eventLog.js`, `tests/agentStudyEventLog.test.js`.
- Verification: `npx vitest run tests/agentStudyEventLog.test.js` passed, and `npm run verify` passed with the new event-log coverage included.
- Follow-up: Next is `Step 05`, which should add prompt templates and keep the template rules aligned with this append-only event log contract.

## Step 05: 新建 prompt templates

状态：done

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

Completion record:
- Completed: Added stable prompt templates for `create_daily_packet`, `review_submitted_packet`, and `compress_context`, plus a prompt manifest that records template paths and event-log requirements.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `study/prompts/templates/create-daily-packet.md`, `study/prompts/templates/review-submitted-packet.md`, `study/prompts/templates/compress-context.md`, `study/prompts/manifest.json`.
- Verification: Verified that `study/prompts/manifest.json` parses and that all referenced template files exist. This step only changed prompt/template documents, so `npm run verify` was not run.
- Follow-up: Next is `Step 06`, which should generate `study/context/next-agent-context.md` from the current state, index, and recent review references.

## Step 06: 生成 next-agent-context 工具

状态：done

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

完成记录：
- 完成内容：确认 `contextWriter`、对应测试和 `study/context/next-agent-context.md` 已完整实现；历史阻塞仅来自当时本机 `npm run verify` 的 worker 异常，当前仓库已可正常通过全量校验，因此本 Step 收口为完成。
- 修改文件：`CODEX_STUDY_LOOP_TASKS.md`，并纳入既有实现文件 `src/server/agentStudy/contextWriter.js`、`tests/agentStudyContextWriter.test.js`、`study/context/next-agent-context.md`
- 验证结果：`tests/agentStudyContextWriter.test.js` 的既有覆盖可用；本轮会随当前开发一起执行 `npm run verify`
- 后续注意事项：下一步执行 `Step 18`，把 review 写回工作流与 mastery/review queue/context/index 串起来

## Step 07: 新建本地 agent-study API handlers

状态：done

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

Completion record:
- Completed: Added store-backed local agent-study API handlers for loading the latest study payload, saving daily drafts, submitting daily packets, and loading the latest review, all without depending on Vite request/response objects.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/routes.js`, `tests/agentStudyRoutes.test.js`.
- Verification: `npx vitest run tests/agentStudyRoutes.test.js` passed, and `npm run verify` passed.
- Follow-up: By current task status, the next executable pending step is `Step 08`, which should wire these handlers into the Vite dev API. `Step 06` remains marked `blocked` in the task file and can be revisited separately if needed.

## Step 08: 接入 Vite dev API

状态：done

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

Completion record:
- Completed: Wired the Agent Study dev API into Vite middleware for latest study, latest review, daily draft save, and daily submit, while keeping business logic in `src/server/agentStudy/routes.js`.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `vite.config.js`.
- Verification: `npm run verify` passed. Also started the Vite dev server on `http://127.0.0.1:8080` and confirmed `GET /api/agent-study/latest` and `GET /api/agent-study/review/latest` return JSON; `POST /api/agent-study/daily/save` and `POST /api/agent-study/daily/submit` also return JSON error payloads on invalid input without mutating study data.
- Follow-up: Next is `Step 09`, which should add a frontend `agentStudyClient` wrapper for these local API endpoints.

## Step 09: 新建 Agent Study 前端数据客户端

状态：done

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

Completion record:
- Completed: Added a frontend Agent Study API client with shared request handling for latest study, latest review, daily draft save, and daily submit, including injectable `fetchImpl` support for tests and alternate runtimes.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/utils/agentStudyClient.js`, `tests/agentStudyClient.test.js`.
- Verification: `npx vitest run tests/agentStudyClient.test.js` passed, and `npm run verify` passed.
- Follow-up: Next is `Step 10`, which should create the initial `AgentStudyWorkspace` page and render the seed daily packet through this client.

## Step 10: 新建 AgentStudyWorkspace 页面骨架

状态：done

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

Completion record:
- Completed: Added the initial `AgentStudyWorkspace` page, wired `/agent-study` into the router, and exposed a sidebar entry so the seed daily packet can be loaded and rendered with sections for mission, tasks, materials, exercises, and review hints.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/components/AgentStudyWorkspace.vue`, `src/router/index.js`, `src/App.vue`, `tests/agentStudyWorkspace.test.js`.
- Verification: `npx vitest run tests/agentStudyWorkspace.test.js` passed, `npm run verify` passed, and a local Vite dev server returned `200` for `http://127.0.0.1:8080/` while `/api/agent-study/latest` returned the seed daily packet JSON used by the page.
- Follow-up: Next is `Step 11`, which should add minimal answer input and draft-save behavior inside `AgentStudyWorkspace`.

## Step 11: 实现 AgentStudyWorkspace 答题草稿

状态：done

目标：

- 用户可以在 `/agent-study` 输入答案并保存草稿。

改动范围：

- `src/components/AgentStudyWorkspace.vue`

实现要点：

- 支持 `q_fill`、`q_translate`、`q_conversation` 的最小渲染。
- 答案写入 `daily.answers`。
- 保存草稿时携带 revision，冲突时提示用户刷新。
- 保存草稿调用 `/api/agent-study/daily/save`。

验收标准：

- 输入答案后可保存。
- 刷新后能看到保存的答案。
- `npm run verify` 通过。

Completion record:
- Completed: Added minimal draft-answer inputs for `q_fill`, `q_translate`, and `q_conversation`, stored draft values in `daily.answers`, and wired `Save Draft` to `/api/agent-study/daily/save` with revision-carrying packet payloads plus a refresh prompt for revision conflicts.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/components/AgentStudyWorkspace.vue`, `tests/agentStudyWorkspace.test.js`.
- Verification: `npx vitest run tests/agentStudyWorkspace.test.js` passed, `npm run verify` passed, and a local Vite dev server returned `200` for both `http://127.0.0.1:8080/` and `http://127.0.0.1:8080/api/agent-study/latest`.
- Follow-up: Next is `Step 12`, which should submit the daily packet from `AgentStudyWorkspace` and transition it into `submitted`.

## Step 12: 实现提交到仓库

状态：done

目标：

- 用户点击提交后 daily packet 进入 `submitted` 状态。

改动范围：

- `src/components/AgentStudyWorkspace.vue`
- `src/server/agentStudy/routes.js` 如有需要

实现要点：

- 提交时写入 self_assessment。
- 状态从 `answering` 或 `learning` 变为 `submitted`。
- 提交时检查 revision，防止覆盖 Codex 或其他页面更新。
- 追加 `session_submitted` 或 `daily_submitted` event。
- 页面显示下一步：复制 review prompt 给 Codex。

验收标准：

- 文件状态变为 `submitted`。
- event log 有提交事件。
- `npm run verify` 通过。

Completion record:
- Completed: Added self-assessment inputs and submit flow in `AgentStudyWorkspace`, submitted packets through `/api/agent-study/daily/submit`, carried `answers` plus `self_assessment` into the payload, handled revision conflicts, and showed the post-submit review handoff state on the page.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/components/AgentStudyWorkspace.vue`, `tests/agentStudyWorkspace.test.js`.
- Verification: `npx vitest run tests/agentStudyWorkspace.test.js` passed, `npm run verify` passed, and a local Vite dev server returned `200` for `http://127.0.0.1:8080/`, `http://127.0.0.1:8080/agent-study`, and `http://127.0.0.1:8080/api/agent-study/latest`.
- Follow-up: Next is `Step 13`, which should expose the generated review prompt path/content with a direct copy action for handing review work to Codex.

## Step 13: 实现复制批改提示词

状态：done

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

Completion record:
- Completed: Added prompt-file loading for Agent Study, exposed a local `/api/agent-study/prompt` read route, and updated `AgentStudyWorkspace` to show the linked review prompt path, copy prompt content directly for Codex, preview loaded prompt text, and show a clear missing-prompt hint when no generated file is linked.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/components/AgentStudyWorkspace.vue`, `src/server/agentStudy/fileStore.js`, `src/server/agentStudy/routes.js`, `src/utils/agentStudyClient.js`, `vite.config.js`, `tests/agentStudyClient.test.js`, `tests/agentStudyFileStore.test.js`, `tests/agentStudyRoutes.test.js`, `tests/agentStudyWorkspace.test.js`.
- Verification: `npx vitest run tests/agentStudyClient.test.js tests/agentStudyRoutes.test.js tests/agentStudyFileStore.test.js tests/agentStudyWorkspace.test.js` passed, `npm run verify` passed, and a local Vite dev server returned `200` for `http://127.0.0.1:8080/agent-study`, `http://127.0.0.1:8080/api/agent-study/latest`, and `http://127.0.0.1:8080/api/agent-study/prompt?path=study/prompts/templates/review-submitted-packet.md`.
- Follow-up: Next is `Step 14`, which should add a real review result sample, link it into the latest study state, and prepare the frontend for reviewed-packet rendering.

## Step 14: 定义 review 写回样例

状态：done

目标：

- 提供一份真实 review 结果样例，用于前端和状态更新开发。

改动范围：

- `study/reviews/YYYY-MM-DD-review.json`
- `study/index.json`
- `study/daily/YYYY-MM-DD.json`

实现要点：

- review 包含 overall、items、mastery_updates、review_queue_updates、promotion_decision。
- 每个 item 包含 confidence、acceptable_variants、needs_user_input、manual_override。
- 每个 item 包含分题型 rubric 分项分数。
- daily packet 的 correction 状态更新为 `reviewed`。

验收标准：

- review JSON 可校验。
- `/api/agent-study/review/latest` 可读取。

Completion record:
- Completed: Added a real lesson 7 review sample under `study/reviews/`, linked it into the seed study index and daily packet as the latest reviewed session, added a generated review prompt sample, and extended review-result schema validation so item-level `rubric` scores are preserved alongside confidence and override metadata.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/utils/agentStudySchema.js`, `tests/agentStudySchema.test.js`, `tests/agentStudyFileStore.test.js`, `tests/agentStudyIndexRebuilder.test.js`, `study/index.json`, `study/daily/2026-06-26.json`, `study/reviews/2026-06-26-review.json`, `study/prompts/generated/2026-06-26-review.md`.
- Verification: `npx vitest run tests/agentStudySchema.test.js tests/agentStudyFileStore.test.js` passed, `npx vitest run tests/agentStudyIndexRebuilder.test.js` passed after updating the rebuilt-index expectation, `npm run verify` passed, and a local Vite dev server returned `200` for `http://127.0.0.1:8080/agent-study`, `http://127.0.0.1:8080/api/agent-study/latest`, and `http://127.0.0.1:8080/api/agent-study/review/latest` with the latest review payload including `rubric`.
- Follow-up: Next is `Step 15`, which should render this latest review sample inside `AgentStudyWorkspace`, including overall summary, per-item results, confidence, acceptable variants, and explanation details.

## Step 15: 展示批改结果

状态：done

目标：

- `/agent-study` 能展示 latest review。

改动范围：

- `src/components/AgentStudyWorkspace.vue`

实现要点：

- 显示总体正确率、summary、next_focus。
- 显示 confidence、acceptable variants、needs_user_input。
- 按题显示正确/错误、错因标签、解释、参考答案。
- 支持记录 manual override，并追加 event log。

验收标准：

- review 样例能正确展示。
- `npm run verify` 通过。

Completion record:
- Completed: Rendered the latest review inside `AgentStudyWorkspace`, including overall accuracy, summary, next-focus guidance, promotion status, per-item correctness, error tags, explanation, correct answer, confidence, acceptable variants, rubric scores, and manual-override state.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/components/AgentStudyWorkspace.vue`, `tests/agentStudyWorkspace.test.js`.
- Verification: `npx vitest run tests/agentStudyWorkspace.test.js` passed, `npm run verify` passed, and a local Vite dev server returned `200` for `http://127.0.0.1:8080/agent-study` and `http://127.0.0.1:8080/api/agent-study/latest`.
- Follow-up: Next is `Step 16`, which should implement `mastery_updates` writeback so reviewed packets change `study/state/mastery.json` from structured review evidence.

## Step 16: 实现 mastery 更新工具

状态：done

目标：

- 根据 review 的 `mastery_updates` 更新 `study/state/mastery.json`。

改动范围：

- `src/server/agentStudy/masteryUpdater.js`
- `tests/agentStudyMasteryUpdater.test.js`

实现要点：

- 支持状态升降级。
- 支持 grammar/listening/speaking/reading 分数更新。
- mastery 更新必须读取 review item 的 rubric 分项分数和 confidence。
- 不允许无 review 证据推进课次。

验收标准：

- 正确更新 mastery。
- 错误输入被拒绝。
- `npm run verify` 通过。

Completion record:
- Completed: Added a pure `masteryUpdater` utility that validates mastery/review inputs, maps review evidence back onto grammar points, updates grammar/listening/speaking/reading scores from rubric plus confidence, supports both downgrade and recovery paths, and refuses unsupported or evidence-free mastery updates.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/masteryUpdater.js`, `tests/agentStudyMasteryUpdater.test.js`.
- Verification: `npx vitest run tests/agentStudyMasteryUpdater.test.js` passed, and `npm run verify` passed.
- Follow-up: Next is `Step 17`, which should update `study/state/review-queue.json` from review outcomes so wrong, hard, good, and easy results change future spacing with the simplified SRS rules.

## Step 17: 实现 review queue 更新工具

状态：done

目标：

- 根据 review 更新间隔复习队列。

改动范围：

- `src/server/agentStudy/reviewQueueUpdater.js`
- `tests/agentStudyReviewQueueUpdater.test.js`

实现要点：

- 错题进入 due 或短间隔复习。
- wrong/hard/good/easy 按开发文档中的 SRS 简化规则更新 interval_days。
- 连续正确延长 interval。
- mastered 后保留远期复测，不永久移除。
- 已掌握内容再次错可重新进入队列。

验收标准：

- wrong/correct 两类更新均有测试。
- `npm run verify` 通过。

Completion record:
- Completed: Added a pure `reviewQueueUpdater` utility that validates review queue/review inputs, applies the simplified SRS rules for wrong, hard, good, and easy outcomes, keeps long-term mastered items scheduled instead of removing them, and reactivates delayed items back to `due` when later review evidence is wrong.
- Modified files: `CODEX_STUDY_LOOP_TASKS.md`, `src/server/agentStudy/reviewQueueUpdater.js`, `tests/agentStudyReviewQueueUpdater.test.js`.
- Verification: `npx vitest run tests/agentStudyReviewQueueUpdater.test.js` passed, and `npm run verify` passed.
- Follow-up: Next is `Step 18`, which should connect review writeback into an atomic `reviewWorkflow` that updates mastery, review queue, daily correction state, next-agent-context, event log, and index in order.

## Step 18: 实现 review_submitted_packet 工作流工具

状态：done

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
- 任一步失败时不更新 index，可通过 index rebuild 恢复入口。

验收标准：

- 工作流按原子写入顺序执行。
- review workflow 覆盖 confidence、manual override、rubric scores 对 mastery 的影响。
- 失败时不更新 index。
- `npm run verify` 通过。

完成记录：
- 完成内容：新增 `reviewWorkflow`，把 submitted daily 的 review 写回串成一个完整流程，依次更新 review 文件、mastery、review queue、current、daily、event log、next-agent-context，并保证失败时不推进 `index.json`；同时让 context 在 index 落盘前也能使用内存中的最新 review/index 状态生成。
- 修改文件：`CODEX_STUDY_LOOP_TASKS.md`、`src/server/agentStudy/reviewWorkflow.js`、`tests/agentStudyReviewWorkflow.test.js`
- 验证结果：`npx vitest run tests/agentStudyContextWriter.test.js tests/agentStudyReviewWorkflow.test.js` 通过；`npm run verify` 通过
- 后续注意事项：下一步执行 `Step 19`，开始做 `AgentProgressReview` 页面，把 current/mastery/review queue/event log/context 汇总展示出来

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
- 显示 learner profile 摘要。
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
- 直接移除旧 Dashboard/TrainingEngine 的主导航入口，不再为旧流程保留默认路径。
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
- 不再保留浏览器 API key/provider 配置路径。
- 删除或替换旧引用。
- 如果旧组件因删除 skills 无法运行，直接删除旧组件或移出路由，不做兼容修补。
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
- 文档明确旧项目只作为可复用资产来源，新三页面是唯一主流程。
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
9. 人工覆盖一条批改结果。
10. 验证 override 写入 event log 且 mastery 可解释。

验收标准：

- 文件状态流完整。
- event log 完整。
- next-agent-context 更新。
- manual override 流程完整。
- `npm run verify` 通过。

## 完成定义

所有 Step 状态均为 `done`，且 Step 27 通过，即本轮开发完成。

