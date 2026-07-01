# Codex Study Loop Agent File Workflow

更新时间：2026-07-01

## 1. 本轮修正目标

把 Codex Study Loop 拉回最初设计：学习内容、出题、批改和下一步计划由编辑器里的 Codex 对话生成并写入项目文件；前端只负责读取这些文件、承载作答、提交答案、展示批改结果，并给用户一段可复制给 Codex 的完整提示词。

不再把“生成学习包 / 出题 / 批改”设计成前端调用 LLM 服务器的主路径。前端可以保留本地文件读写 API，但这些 API 只服务于展示、保存和提交，不负责调用模型生成教学内容。

## 2. 角色边界

### Codex 对话侧

- 读取 `study/` 状态、课纲、历史事件和用户作答。
- 生成 `study/daily/*.json`。
- 批改 submitted daily packet，生成 `study/reviews/*.json`。
- 更新 `study/state/mastery.json`、`study/state/review-queue.json`、`study/state/current.json`。
- 更新 `study/index.json`、`study/context/next-agent-context.md`。
- 追加 `study/logs/agent-events.jsonl`。
- 不覆盖历史 daily/review/log。

### 前端侧

- 展示 latest daily packet、学习材料、题目、答案草稿、提交状态和 review result。
- 支持保存答案草稿。
- 支持提交当前 daily packet。
- 提交后在数据下方显示完整 Codex 批改提示词，并提供复制按钮。
- 提交后提示用户回到编辑器，把提示词交给 Codex。
- 不主动调用 LLM 生成题目。
- 不在页面内隐藏地走“LLM 服务器出题”。

## 3. 目标交互循环

### 3.1 生成学习包

用户在编辑器里对 Codex 说：

```text
请读取 study/context/next-agent-context.md 和 study/state/*，为今天生成学习包。
```

Codex 执行：

1. 读取 `study/index.json`、`study/context/next-agent-context.md`、`study/state/current.json`、`study/state/profile.json`、`study/state/mastery.json`、`study/state/review-queue.json`、`src/data/syllabus.json`。
2. 判断当前课次、薄弱点、复习队列和时间预算。
3. 生成新的 `study/daily/YYYY-MM-DD.json`。
4. 生成 `study/prompts/generated/YYYY-MM-DD-review.md`，内容为批改该 daily packet 的完整提示词。
5. 更新 `study/index.json` 指向最新 daily 和 prompt。
6. 更新 `study/context/next-agent-context.md`。
7. 追加 `study/logs/agent-events.jsonl`。

前端执行：

1. 用户打开或刷新 `/agent-study`。
2. 页面读取 latest daily packet 并展示。

### 3.2 前端作答与提交

用户在前端完成题目：

1. 输入答案。
2. 点击“保存草稿”，前端只更新当前 daily packet 的 `answers` 和 `self_assessment`。
3. 点击“提交学习包”，前端将 daily packet 状态改为 `submitted`。
4. 页面在提交结果下方展示：
   - 当前提交的 daily 路径。
   - 当前答案摘要。
   - 完整 Codex 批改提示词。
   - 复制按钮。

### 3.3 Codex 批改与生成下一步

用户回到编辑器，把页面下方提示词交给 Codex。

Codex 执行：

1. 读取提示词中列出的文件。
2. 读取 submitted daily packet。
3. 批改每一题，生成结构化 review result。
4. 写入 `study/reviews/YYYY-MM-DD-review.json`。
5. 更新 submitted daily packet 的 `correction.status`、`correction.review_file` 和 `review_result` 引用。
6. 更新 mastery、review queue、current、index、next-agent-context。
7. 追加 event log。
8. 给用户总结本次表现和下一步要做什么。

前端执行：

1. 用户刷新 `/agent-study` 或 `/agent-progress-review`。
2. 页面展示最新批改结果、薄弱点、复习队列和下一步建议。

## 4. 前端需要改造的内容

### 4.1 移除或降级前端生成学习包入口

当前页面里的“生成今日学习包”不应再触发 `/api/agent-study/daily/generate` 或任何 LLM 服务器调用。

改造方向：

- 移除按钮；或
- 改成“复制生成学习包提示词”，让用户回到编辑器交给 Codex。

推荐第一版采用“复制生成学习包提示词”，因为它能减少来回输入成本。

### 4.2 提交后显示完整 Codex 批改提示词

提交成功后，页面应在 daily packet 数据下方显示一个固定区域：

- 标题：`交给 Codex 批改`
- 说明：简短告诉用户回到编辑器粘贴给 Codex。
- 提示词正文：由当前 daily packet、index、prompt template 和 submitted 状态生成。
- 操作：复制提示词。

提示词必须自包含，但不复制整个 daily JSON。它应该引用文件路径，并明确 Codex 要读取哪些文件、写哪些文件、禁止覆盖哪些历史文件。

### 4.3 页面空状态要服务 Agent 文件流

当没有 latest daily packet 时，不应提示“点击生成今日学习包并等待系统出题”。

应改为：

- 显示当前没有学习包。
- 提供“复制生成学习包提示词”。
- 提醒用户把提示词交给编辑器里的 Codex。

### 4.4 保留的前端写入能力

前端仍然需要本地 API：

- `GET /api/agent-study/latest`
- `POST /api/agent-study/daily/save`
- `POST /api/agent-study/daily/submit`
- `GET /api/agent-study/progress`
- `GET /api/agent-study/review-drill/latest`

这些接口只做文件读写和状态提交，不调用 LLM。

## 5. 提示词生成规则

### 5.1 生成学习包提示词

页面空状态或工作台顶部可生成这段提示词：

```text
请作为 Codex Study Loop 学习 agent 执行“生成今日学习包”。

先读取：
- study/index.json
- study/context/next-agent-context.md
- study/state/profile.json
- study/state/current.json
- study/state/mastery.json
- study/state/review-queue.json
- study/state/promotion-rules.json
- src/data/syllabus.json
- study/prompts/templates/create-daily-packet.md

请根据当前课次、薄弱点、复习队列、时间预算和课纲，生成新的 daily packet。

写入要求：
- 新建 study/daily/YYYY-MM-DD.json
- 新建或更新 study/prompts/generated/YYYY-MM-DD-review.md
- 更新 study/index.json
- 更新 study/context/next-agent-context.md
- 追加 study/logs/agent-events.jsonl

约束：
- 不要覆盖历史 daily/review/log
- 不要调用前端 LLM 出题逻辑
- 题目必须用于学习语法、输入和输出，不要让学习者猜题意
- 题干用中文，答案目标用自然日语
- 完成后运行 npm run verify；如果无法运行，说明原因
```

### 5.2 批改提交提示词

提交后页面应生成这段提示词，并替换其中路径：

```text
请作为 Codex Study Loop 学习 agent 执行“批改已提交学习包”。

先读取：
- study/index.json
- study/context/next-agent-context.md
- study/state/profile.json
- study/state/current.json
- study/state/mastery.json
- study/state/review-queue.json
- study/state/promotion-rules.json
- study/prompts/templates/review-submitted-packet.md
- {daily_path}

当前提交：
- daily packet: {daily_path}
- review prompt: {prompt_path}
- status: submitted

请完成：
- 批改 daily packet 中每一道题
- 写入 study/reviews/YYYY-MM-DD-review.json
- 更新 daily packet 的 correction 状态和 review_file
- 更新 study/state/mastery.json
- 更新 study/state/review-queue.json
- 更新 study/state/current.json
- 更新 study/index.json
- 更新 study/context/next-agent-context.md
- 追加 study/logs/agent-events.jsonl

批改要求：
- 输出结构必须符合 review result schema
- 每题说明是否正确、错因标签、参考答案、可接受变体、解释和是否建议重做
- mastery 更新必须基于本次 review evidence
- 如果可以推进下一步，写清楚理由；如果不能推进，写清楚下一轮优先练什么

约束：
- 不要覆盖历史 daily/review/log
- 不要修改无关学习数据
- 完成后运行 npm run verify；如果无法运行，说明原因
```

## 6. 数据展示建议

提交后的页面顺序：

1. 提交成功状态。
2. 本次提交路径和时间。
3. 当前 answers 摘要。
4. `交给 Codex 批改` 提示词区域。
5. 复制按钮。
6. 如果已有 review，则在下方显示批改结果。

这样用户不用在前端、文件和编辑器之间寻找上下文，只需要“提交 -> 复制 -> 粘贴给 Codex -> 刷新页面”。

## 7. 需要删除或停用的内容

- 停用 `/api/agent-study/daily/generate` 作为前端主流程入口。
- 停用 `AgentStudyWorkspace` 里直接生成学习包的模型调用按钮。
- 保留已经存在的 daily packet schema 和 file store，因为它们仍然服务 Codex 写入后的展示和前端提交。
- 对之前新增的兜底出题器不再继续打磨；它不应成为主产品路径。

## 8. 验收标准

- 没有 latest daily 时，页面提供“复制生成学习包提示词”，而不是自己出题。
- 有 latest daily 时，页面正常展示学习包和作答区。
- 保存草稿只写 answers/self assessment，不生成题。
- 提交学习包后，页面下方显示完整批改提示词。
- 用户把提示词交给 Codex 后，Codex 可以只根据仓库文件完成批改和下一步生成。
- `npm run verify` 通过。

