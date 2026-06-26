# Codex Agent Study Loop Refactor Plan

更新时间：2026-06-26

## 1. 目标

把当前项目从“前端调用模型生成练习的本地工具”，逐步重构成“Codex 参与编排的本地优先学习执行系统”。

核心目标：

- 保留当前答题逻辑，先不推翻现有训练页。
- 让 Codex 根据仓库内的学习状态、课程大纲、错题和历史记录生成当天任务。
- 让前端只负责读取结构化学习数据、展示任务、收集作答结果。
- 用户完成答题后，把项目生成的批改提示词交给 Codex，由 Codex 批改并写回结构化结果。
- 每次 Codex 生成任务、练习、批改、总结时，都在仓库中留下可追踪记录。
- 生成的数据必须能被当前前端稳定渲染和使用。

## 2. 推荐方向

推荐采用“Codex 作为学习编排 Agent，项目作为状态仓库”的方案。

不建议把 Codex 会员账号包装成运行时 API 中转站。原因：

- Codex/ChatGPT 订阅适合交互式或半自动工程任务，不等价于稳定的线上 LLM API。
- 中转站需要处理登录态、凭据、安全、限流、并发、失败重试和合规边界，复杂度高。
- 当前需求更像个人学习工作流，不需要一开始就做在线服务。
- 仓库已经有本地持久化、结构化大纲、错题本、任务计划和服务端路由雏形，适合先做本地闭环。

所以后续架构应当是：

```text
Codex 对话/执行
  -> 读取 data.json、syllabus.json、历史记录
  -> 生成今日计划、练习数据、批改提示词
  -> 写入项目结构化文件
  -> 前端读取并展示
  -> 用户作答
  -> 前端保存作答结果
  -> 用户回到 IDE/Codex
  -> Codex 读取作答结果并批改
  -> Codex 写回批改、掌握度、后续任务
```

## 3. 当前系统保留边界

短期保留：

- `src/components/TrainingEngine.vue` 当前答题流程。
- `src/store/mainStore.js` 作为长期学习状态入口。
- `src/store/trainingStore.js` 作为当前会话状态入口。
- `data.json` 导入/导出和本地同步能力。
- 现有 AI 生成/批改模块，先不删除。

短期不要做：

- 不重写所有题型 UI。
- 不把所有练习都迁移到云端。
- 不把 Codex 登录态做成公共服务。
- 不移除 `data.json`。
- 不把学习状态散落到多个无 schema 的临时文件里。

## 4. 新增数据目录建议

建议新增一个专门目录：

```text
study/
  state/
    current.json
    mastery.json
    promotion-rules.json
  context/
    next-agent-context.md
    snapshots/
      2026-W26-context.md
  daily/
    2026-06-26.json
  missions/
    2026-06-26.json
  sessions/
    2026-06-26-session-001.json
  prompts/
    2026-06-26-correction.md
  reviews/
    2026-06-26-review.json
  logs/
    agent-events.jsonl
```

职责划分：

- `study/state/current.json`：Codex 友好的当前学习摘要，来自 `data.json` 但更易读。
- `study/state/mastery.json`：长期掌握度、晋级状态、弱点索引，不跟每天题目混在一起。
- `study/state/promotion-rules.json`：定义什么时候可以从复习进入新课。
- `study/context/next-agent-context.md`：前端和 Codex 都能展示/复制的下一轮上下文入口。
- `study/context/snapshots/*`：定期压缩后的上下文快照。
- `study/daily/YYYY-MM-DD.json`：当天完整学习包，包含计划、题目、答案、批改和复盘摘要。
- `study/missions/YYYY-MM-DD.json`：当天任务和练习入口。
- `study/sessions/*`：一次学习会话的题目、用户作答、状态。
- `study/prompts/*`：给 Codex 批改用的提示词，用户可以直接复制。
- `study/reviews/*`：Codex 批改后的结构化结果。
- `study/logs/agent-events.jsonl`：每次 Agent 生成、批改、更新状态的事件流水。

如果希望操作更简单，可以把 `missions/sessions/reviews` 先折叠进 `study/daily/YYYY-MM-DD.json`，等数据量变大后再拆分。推荐最终形态是：每日文件负责当天事实，全局 state 负责跨天进度。

## 5. 今日任务数据结构

`study/missions/YYYY-MM-DD.json` 建议结构：

```json
{
  "schema_version": 1,
  "date": "2026-06-26",
  "source": "codex",
  "status": "ready",
  "learner_snapshot": {
    "current_lesson": 7,
    "recent_weak_lessons": [7, 19, 20],
    "recent_mistake_count": 67,
    "priority_skills": ["grammar", "listening", "speaking"]
  },
  "mission": {
    "title": "第 7 课基础重建与输出练习",
    "available_minutes": 60,
    "focus_lessons": [7],
    "goals": [
      "复习第 7 课核心句型",
      "完成一组可批改输出题",
      "记录新的薄弱点"
    ]
  },
  "tasks": [
    {
      "id": "task-001",
      "type": "grammar_review",
      "title": "复习第 7 课核心语法",
      "minutes": 10,
      "required": true,
      "status": "pending",
      "session_id": null
    },
    {
      "id": "task-002",
      "type": "agent_generated_practice",
      "title": "完成 Codex 生成练习",
      "minutes": 30,
      "required": true,
      "status": "pending",
      "session_id": "2026-06-26-session-001"
    }
  ],
  "rendering_contract": {
    "frontend_entry": "Dashboard",
    "session_files": ["study/sessions/2026-06-26-session-001.json"],
    "correction_prompt": "study/prompts/2026-06-26-correction.md"
  }
}
```

## 6. 学习会话数据结构

`study/sessions/YYYY-MM-DD-session-001.json` 建议结构：

```json
{
  "schema_version": 1,
  "id": "2026-06-26-session-001",
  "date": "2026-06-26",
  "lesson": 7,
  "status": "answering",
  "generated_by": "codex",
  "exercise_policy": {
    "question_count": 8,
    "types": ["q_fill", "q_translate", "q_conversation"],
    "difficulty": "基础巩固",
    "allowed_grammar_points": []
  },
  "exercises": [
    {
      "id": "ex-001",
      "type": "q_translate",
      "target_grammar": "example grammar",
      "chinese_prompt": "请把这个句子翻译成日语。",
      "vocab_hints": [],
      "answer_pattern": "reference answer"
    }
  ],
  "answers": {
    "ex-001": ""
  },
  "result": null,
  "files": {
    "correction_prompt": "study/prompts/2026-06-26-correction.md",
    "review_result": "study/reviews/2026-06-26-review.json"
  }
}
```

关键点：

- `exercises` 尽量兼容现有 `TrainingEngine.vue` 使用的字段。
- `answers` 是用户答题后前端写回的位置。
- `status` 从 `answering` 变成 `submitted` 后，Codex 才进行批改。
- `result` 由 Codex 批改后写回。

## 7. 批改提示词生成

每次生成 session 时，同时生成 `study/prompts/YYYY-MM-DD-correction.md`。

提示词应包含：

- 当前批改目标。
- 学习者当前课次和允许知识范围。
- 题目 JSON 文件路径。
- 批改输出必须写入的 review JSON 路径。
- 批改标准。
- 状态更新要求。

示例：

```markdown
# Codex 批改请求

请读取：

- `study/sessions/2026-06-26-session-001.json`
- `data.json`
- `src/data/syllabus.json`

任务：

1. 批改 session 中所有已填写答案。
2. 输出结构化批改结果到 `study/reviews/2026-06-26-review.json`。
3. 将错题或值得收藏的题目同步追加到 `data.json` 的 `mistakes_book`。
4. 根据表现更新 `lesson_mastery`、`pattern_mastery` 或 `progress.lesson_stats`。
5. 在 `study/logs/agent-events.jsonl` 追加一条事件。

批改标准：

- 日语表达意思正确时，不因汉字缺失单独判错。
- 对假名、助词、时态、礼貌体进行重点检查。
- 输出中文解释，短而明确。
- 不要删除已有学习记录。

输出要求：

- 修改文件前先读取当前文件。
- 保持 JSON 可解析。
- 不覆盖未相关的历史记录。
```

这样用户流程会很轻：

1. 对 Codex 说“生成今天任务”。
2. 打开前端做题。
3. 前端保存答案。
4. 复制 `study/prompts/...correction.md` 内容给 Codex，或者直接让 Codex 执行该文件里的批改请求。

## 8. Agent 事件日志

`study/logs/agent-events.jsonl` 每行一个 JSON：

```json
{"time":"2026-06-26T10:00:00+08:00","actor":"codex","event":"mission_created","mission_file":"study/missions/2026-06-26.json","session_files":["study/sessions/2026-06-26-session-001.json"]}
{"time":"2026-06-26T11:10:00+08:00","actor":"frontend","event":"session_submitted","session_file":"study/sessions/2026-06-26-session-001.json"}
{"time":"2026-06-26T11:20:00+08:00","actor":"codex","event":"session_reviewed","review_file":"study/reviews/2026-06-26-review.json"}
```

用途：

- 追踪 Codex 做过什么。
- 方便周复盘。
- 方便发现数据覆盖或重复生成。
- 未来可在前端显示学习时间线。

## 9. 每日学习包

你的“每天的题目数据、批改数据、结果记录到一个单独文件”的思路是合理的。建议把这个文件称为 Daily Packet：

```text
study/daily/2026-06-26.json
```

它是当天学习闭环的主记录，建议包含：

```json
{
  "schema_version": 1,
  "date": "2026-06-26",
  "status": "answering",
  "context_version": "context-2026-W26",
  "mission": {
    "title": "第 7 课基础重建",
    "plan_type": "review_then_output",
    "focus_lessons": [7],
    "available_minutes": 60,
    "tasks": []
  },
  "study_materials": [
    {
      "id": "material-001",
      "type": "grammar_note",
      "lesson": 7,
      "title": "授受表达复习",
      "content": "Agent 生成的语法说明"
    }
  ],
  "review_items": [
    {
      "id": "review-001",
      "source": "mistakes_book",
      "grammar_point": "example",
      "reason": "最近多次出错"
    }
  ],
  "exercises": [],
  "answers": {},
  "correction": {
    "status": "pending",
    "prompt_file": "study/prompts/generated/2026-06-26-review.md",
    "review_file": "study/reviews/2026-06-26-review.json"
  },
  "review_result": null,
  "next_agent_context": {
    "file": "study/context/next-agent-context.md",
    "summary": ""
  }
}
```

好处：

- 前端只需要读取当天一个文件就能渲染主流程。
- Codex 批改时也只需要优先读取当天文件和全局状态。
- 每天的学习证据天然归档，不会被后续任务覆盖。
- 将来做日历、周报、复盘都很简单。

注意：

- Daily Packet 不应承担长期状态数据库职责。
- 全局掌握度仍然写入 `study/state/mastery.json` 或 `data.json`。
- Daily Packet 中可以保留当天结果快照，但不要让它成为唯一真实进度来源。

## 10. 全局进度与掌握度

除每日文件外，需要一份全局状态维护整体学习进度：

```text
study/state/mastery.json
```

建议结构：

```json
{
  "schema_version": 1,
  "updated_at": "2026-06-26T00:00:00+08:00",
  "current_lesson": 7,
  "lesson_status": {
    "7": {
      "status": "rebuilding",
      "grammar": 0.35,
      "listening": 0.2,
      "speaking": 0.15,
      "reading": 0.3,
      "last_practiced_at": "2026-06-26",
      "promotion_candidate": false
    }
  },
  "grammar_points": {
    "lesson-7/example-pattern": {
      "lesson": 7,
      "status": "weak",
      "score": 0.3,
      "wrong_count": 3,
      "recent_review_ids": []
    }
  },
  "promotion": {
    "current_gate": "lesson-7-foundation",
    "can_advance": false,
    "reason": "输出题正确率和口语掌握度不足"
  }
}
```

Codex 只有在掌握度达到规则时才推进 `current_lesson`。推进不是凭感觉，而是基于可解释证据：

- 最近若干次练习正确率。
- 同一语法点重复错误是否下降。
- 输出题是否能独立完成。
- 复习页中的错题是否连续通过。
- 听说任务是否至少达到最低完成次数。

推荐把晋级规则放在：

```text
study/state/promotion-rules.json
```

示例：

```json
{
  "schema_version": 1,
  "lesson_gate": {
    "min_recent_sessions": 2,
    "min_output_accuracy": 0.75,
    "max_repeat_mistakes_per_key_point": 1,
    "required_skill_scores": {
      "grammar": 0.7,
      "listening": 0.45,
      "speaking": 0.45
    }
  }
}
```

## 11. 上下文压缩和下一轮入口

你提出“定期压缩上下文进度，到新的文件内进行后续进度记录”非常关键。建议用两类文件：

```text
study/context/next-agent-context.md
study/context/snapshots/2026-W26-context.md
```

`next-agent-context.md` 是每天/每次批改后刷新的一页纸上下文，用于你复制给 Codex。它应该短、稳定、可操作。

建议结构：

```markdown
# Next Agent Context

Date: 2026-06-26
Current lesson: 7
Current mode: foundation rebuild

## Read First

- study/daily/2026-06-26.json
- study/state/current.json
- study/state/mastery.json
- src/data/syllabus.json

## Latest Result

- 今天完成了哪些任务
- 哪些题错了
- 哪些语法点仍然不稳

## Agent Next Action

请根据上述文件：

1. 批改或复盘最新提交内容。
2. 更新 mastery 和 current state。
3. 如果达到晋级条件，更新 current_lesson。
4. 生成下一轮 daily packet 和 prompt。
5. 追加 event log。
```

`snapshots/*` 是周期压缩快照，建议每周或每 5 次 session 生成一次。它负责把大量 daily/review/log 压缩成中期记忆。

压缩快照应记录：

- 本阶段学习范围。
- 已确认掌握的语法点。
- 仍然薄弱的语法点。
- 高频错因。
- 复习策略变化。
- 是否推进课次，以及为什么。

这样你每天复制给 Codex 的内容可以很短，但 Codex 仍然能回到仓库读取完整证据。

## 12. 前端改造建议

建议不要继续依赖当前首页里大量手动选择项来承载新流程。旧页面可以先保留，新的 Codex 工作流应新增一个独立页面，例如：

```text
src/components/AgentStudyWorkspace.vue
```

这个页面只服务一件事：读取 Agent 已生成的数据，完成当天学习闭环。

推荐页面信息架构：

- 顶部：今日计划、当前阶段、预计时长、进度。
- 左侧：任务列表，包括计划、复习、学习、答题、批改、复盘。
- 中间：当前任务执行区，展示 Agent 生成的题目或复习材料。
- 右侧：学习上下文摘要，包括当前课次、弱点、最近错题、批改提示词路径。
- 底部：提交按钮和保存状态。

第一阶段只做最少前端改造：

- Dashboard 增加“Agent 今日任务”区域。
- 前端读取 `study/missions/latest.json` 或当天 mission 文件。
- 点击任务进入现有训练页或新增轻量 session runner。
- 答案保存回 `study/sessions/*`，不直接要求前端批改。
- 展示“批改提示词路径”和“一键复制提示词”。

更推荐的第一阶段实际路径：

- 新增 `AgentStudyWorkspace.vue`，不急着改旧 `Dashboard.vue`。
- 路由新增 `/agent-study`。
- 页面只读取 `study/index.json` 指向的 latest mission/session。
- 题目渲染只支持 Agent session 里的最小字段集合。
- 用户作答后点击“提交到仓库”。
- 前端通过本地 dev API 把 session 状态从 `answering` 改成 `submitted`，并写入 answers。
- 页面显示下一步提示：“回到 IDE，让 Codex 执行 correction prompt”。
- 本地 dev server 支持热更新，Codex 写入 daily/context/prompt 后，前端刷新或轮询即可显示最新内容。

这样可以避免旧页面复杂配置干扰新流程。旧页面仍可作为备用训练入口。

第二阶段再做：

- 展示 Codex 批改结果。
- 展示 Agent 事件时间线。
- 从 review 自动生成下一次强化练习入口。
- 将 `data.json` 与 `study/*` 做双向同步或单向派生。

## 13. 复习页和 Review 页

建议新增两个独立页面：

```text
src/components/AgentReviewDrill.vue
src/components/AgentProgressReview.vue
```

### 13.1 复习页

复习页用于处理经常错误的语法、知识点和题目。它不是自由选择题库，而是读取 Agent 根据当前进度生成的复习包：

```text
study/review-drills/2026-06-26.json
```

复习包来源：

- `data.json.mistakes_book`
- `study/reviews/*`
- `study/state/mastery.json`
- 最近 Daily Packet 的错题和低分项

复习页功能：

- 展示 Agent 总结的薄弱语法点。
- 展示由错题变体生成的新题。
- 记录用户答题结果。
- 提交后由 Codex 批改并更新 mastery。
- 当某个语法点连续通过时，Codex 可以把该弱点状态改为 `stabilized` 或 `mastered`。

### 13.2 Review 页

Review 页用于看整体状态，不承担答题：

- 当前主线课次。
- 最近计划和完成情况。
- 掌握度雷达或表格。
- 高频错题/错因。
- 当前复习队列。
- 晋级条件是否满足。
- 最近 Agent 事件日志。
- 下一次建议学习内容。

这个页面应该读取全局状态和压缩上下文：

```text
study/state/current.json
study/state/mastery.json
study/context/next-agent-context.md
study/logs/agent-events.jsonl
```

### 13.3 页面取舍

新流程建议以三个页面为核心：

- `AgentStudyWorkspace`：今天学什么、做什么、提交什么。
- `AgentReviewDrill`：专门复习错题和薄弱点。
- `AgentProgressReview`：看整体进度和计划。

旧的 `src/skills/*` 和旧训练 UI 可以逐步降级：

- 第一阶段：保留，不作为新流程主入口。
- 第二阶段：新 Agent 页面稳定后，把旧技能调用迁移到服务端或删除。
- 第三阶段：如果 Agent Daily Packet 已完全承担出题和批改，`src/skills/generateExercise.js` 与 `src/skills/evaluateSentence.js` 可以删除。

## 14. Agent 上下文和记忆策略

Codex 的单次对话上下文适合完成当天任务，但长期学习进度不应该依赖某一次聊天自然记得。长期记忆应以仓库文件为准。

推荐使用四层上下文：

### 10.1 固定规则层

固定规则放在仓库文档中：

- `AGENTS.md`：仓库级工作规则，例如不要删除 `data.json`、生成数据必须校验、批改必须写日志。
- `CODEX_STUDY_LOOP_REFACTOR.md`：系统设计和长期重构方向。
- 未来可新增 `study/AGENTS.md`：专门约束学习数据目录下的生成、批改和日志规则。

这一层解决“每次 Codex 进入仓库都应该知道什么”。

### 10.2 当前画像层

当前学习画像放在：

```text
study/state/current.json
```

它是给 Codex 快速读取的摘要，不替代 `data.json`，而是从 `data.json`、reviews 和 logs 派生出来。

建议字段：

```json
{
  "schema_version": 1,
  "updated_at": "2026-06-26T00:00:00+08:00",
  "source_files": ["data.json", "study/reviews/*.json", "study/logs/agent-events.jsonl"],
  "current_lesson": 7,
  "learning_mode": "foundation_rebuild",
  "active_goals": ["重建第 7 课输出能力", "回收历史错题"],
  "weakness_summary": [
    {
      "scope": "lesson",
      "key": "7",
      "problem": "最近一次正确率低，需要重新做基础输出题",
      "evidence": ["data.json:progress.lesson_stats.7"]
    }
  ],
  "recent_focus": {
    "grammar": ["第 7 课核心句型"],
    "listening": [],
    "speaking": []
  },
  "next_recommendation": {
    "date": "2026-06-26",
    "plan_type": "review_then_output",
    "minutes": 60
  }
}
```

这一层解决“Codex 不用每次从全量数据里重新猜学习状态”。

### 10.3 会话事实层

每次学习会话都记录为不可随意覆盖的事实文件：

```text
study/sessions/2026-06-26-session-001.json
study/reviews/2026-06-26-session-001-review.json
```

session 记录题目和作答，review 记录批改和掌握度变化。两者都应该包含 `schema_version`、`created_at`、`updated_at`、`status` 和 `source`。

这一层解决“哪一天做了什么、答了什么、Codex 怎么判的”。

### 10.4 事件流水层

所有关键动作追加到：

```text
study/logs/agent-events.jsonl
```

每条事件都应包含：

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

事件类型建议：

- `mission_created`
- `session_created`
- `session_submitted`
- `review_created`
- `state_updated`
- `next_plan_created`

这一层解决“进度可追溯、可复盘、可恢复”。

## 15. 提示词记录策略

提示词不应该只是临时复制文本，应当作为学习记录的一部分保存。

推荐目录：

```text
study/prompts/
  templates/
    create-mission.md
    review-session.md
    update-state.md
  generated/
    2026-06-26-create-mission.md
    2026-06-26-session-001-review.md
```

### 11.1 模板提示词

模板提示词存稳定规则，例如：

- 读取哪些文件。
- 允许写哪些文件。
- 输出 JSON schema。
- 批改标准。
- 不允许覆盖历史。
- 必须追加 event log。

### 11.2 生成提示词

每次 Codex 生成学习任务时，同时生成当次专用提示词。专用提示词应包含当次文件路径、任务 ID、session ID 和输出目标。

这样做有三个好处：

- 用户完成答题后可以直接复制提示词继续批改。
- 几周后可以知道当时要求 Codex 怎么批改。
- 如果批改有问题，可以复现并修正。

### 11.3 Prompt Manifest

建议新增：

```text
study/prompts/manifest.json
```

记录每个提示词的用途：

```json
{
  "schema_version": 1,
  "items": [
    {
      "id": "prompt-2026-06-26-session-001-review",
      "type": "review_session",
      "created_at": "2026-06-26T00:00:00+08:00",
      "prompt_file": "study/prompts/generated/2026-06-26-session-001-review.md",
      "input_files": ["study/sessions/2026-06-26-session-001.json"],
      "expected_output_files": ["study/reviews/2026-06-26-session-001-review.json"]
    }
  ]
}
```

## 16. 新流程页面交互建议

推荐新页面以“阶段”驱动，而不是以“用户选择题型”驱动。

阶段流转：

```text
planned -> reviewing -> learning -> answering -> submitted -> reviewed -> reflected
```

页面按钮建议：

- `开始今日任务`：把 mission/task 标记为进行中。
- `保存草稿`：只保存 answers，不改变状态。
- `提交到仓库`：写入 answers，把 session 状态改为 `submitted`，追加 `session_submitted` 事件。
- `复制批改提示词`：复制 `study/prompts/generated/*review.md`。
- `刷新批改结果`：读取 review 文件，如果存在就展示。
- `完成复盘`：把 mission 标记为 completed，并提示下一次让 Codex 生成后续任务。

提交到仓库的本地接口建议：

```text
POST /api/agent-study/session/save
POST /api/agent-study/session/submit
GET  /api/agent-study/latest
```

这些接口只在本地开发模式使用，先不做生产部署承诺。它们应委托到 `src/server/agentStudy/` 下的可复用模块，避免逻辑写死在 `vite.config.js`。

## 17. 更稳的完整闭环

推荐最终闭环：

```text
1. Codex: 读取 current.json + data.json + 最近 reviews
2. Codex: 生成 mission/session/prompt，并追加日志
3. Frontend: 热更新读取最新 mission
4. User: 在 Agent Study 页面完成计划、复习、学习、答题
5. Frontend: 提交 answers 到 session 文件
6. Codex: 按生成的 review prompt 批改
7. Codex: 写 review、更新 data.json、更新 current.json、追加日志
8. Frontend: 刷新并展示批改结果
9. Codex: 生成下一次建议或明日计划
```

这个流程兼顾了：

- 计划：mission。
- 复习：review task 和 weak points。
- 学习：lesson notes 或 grammar cards。
- 答题：session exercises。
- 批改：review 文件。
- 长期上下文：current state + logs + data.json。

## 18. 设计取舍

可以删除或弱化旧的手动选择 UI，但建议分阶段：

- 第一阶段：不删旧页面，新建 `/agent-study`。
- 第二阶段：确认新流程可用后，把 Dashboard 默认入口改到 Agent Study。
- 第三阶段：旧训练页保留为“自由练习/调试入口”，不再作为主学习路径。
- 第四阶段：如果新流程完全覆盖旧逻辑，再删掉冗余设置和手动题型选择。

这么做比较稳，因为当前答题逻辑还能用，不值得一开始就拆光。新页面可以更贴合你的真实工作流，也能降低重构风险。

`src/skills/generateExercise.js` 和 `src/skills/evaluateSentence.js` 可以被废弃，但不建议在新闭环跑通前直接删除。它们目前仍支撑旧训练页的生成和批改。更稳的路线是：

- 先让 Agent Daily Packet 承担新页面的数据来源。
- 再让旧训练页变成可选入口。
- 最后确认没有页面依赖 `src/skills/*` 后删除。

如果本轮重构不再要求兼容当前可用状态，则取舍可以更激进：

- `AgentStudyWorkspace`、`AgentReviewDrill`、`AgentProgressReview` 成为新的主入口。
- 旧 Dashboard、旧训练页、Settings 里的前端 provider 配置、`src/skills/*` 都只按“可复用代码片段”看待，不再作为必须保留的产品路径。
- 旧的 AI 前端调用逻辑可以整体删除，避免新流程和旧 provider 逻辑并存导致心智负担。
- `data.json` 可以从主数据源降级为迁移输入和备份格式，新的真实学习状态以 `study/` 为准。
- 如果旧 UI 文案乱码严重，优先新建干净页面，而不是在旧页面上修补。

## 19. 系统层面遗漏与补充

需要补充的系统能力：

- Schema 校验：所有 `study/*.json` 写入前都应可被脚本校验。
- 文件索引：维护 `study/index.json`，记录 latest mission、latest session、latest review。
- 防覆盖：同一天多次生成任务时使用 `session-001`、`session-002`，不要覆盖。
- 兼容层：`data.json` 仍是主状态源，`study/*` 是 Agent 工作流数据层。
- 导入导出：未来备份应包含 `data.json` 和 `study/`。
- 测试：先给数据生成/校验脚本加 Vitest，不急着测 UI。
- 编码修复：当前源码和文档存在中文/日文乱码风险，应单独作为前置清理任务。

## 20. 学习层面优化

每日任务不应该只按“当前课次”生成，还应综合：

- 最近 7 天是否学习过。
- 当前课次完成情况。
- 最近错题数量和错题类型。
- 哪些语法点反复错。
- 听力/口语是否长期缺失。
- 是否已经连续多天只做输入，没有输出。

建议每日任务固定包含：

- 5 到 10 分钟复习：从错题或上一课薄弱点开始。
- 20 到 30 分钟主训练：当前课次核心语法和输出题。
- 10 到 15 分钟听说训练：shadowing、听关键词或场景口语。
- 5 分钟复盘：Codex 根据结果写一句总结和下一次重点。

不要每天都追求推进新课。当前 `data.json` 显示第 7 课是主线位置，但历史里第 14、17、19、20 课也有记录，这说明学习路径可能跳跃过。Codex 生成任务时应优先做“主线重建 + 历史弱点回收”。

## 21. 最终 Review 结论

整体方案已经能闭合“计划 -> 学习 -> 答题 -> 提交 -> 批改 -> 记录 -> 复习 -> 晋级”的主循环，但落地前还需要补齐以下设计。

### 21.1 唯一真实来源

需要明确新的真实状态来源：

```text
study/state/current.json
study/state/mastery.json
study/daily/*.json
study/reviews/*.json
study/logs/agent-events.jsonl
```

建议：

- `study/state/current.json` 是当前摘要，不存长历史。
- `study/state/mastery.json` 是晋级和掌握度的真实来源。
- `study/daily/YYYY-MM-DD.json` 是当天事实包。
- `study/reviews/*` 是批改事实。
- `study/logs/agent-events.jsonl` 是审计和时间线。
- `data.json` 只作为迁移输入、兼容导出或旧数据备份，不再作为新流程的唯一真实来源。

否则容易出现 `data.json`、daily packet、mastery 三处都记录进度但互相冲突。

### 21.2 Daily Packet 与拆分文件的边界

Daily Packet 适合做“当天入口”和“当天完整快照”，但不适合无限膨胀。

推荐规则：

- 当天 1 到 2 次短 session：可以全部放进 `study/daily/YYYY-MM-DD.json`。
- 如果一天多次练习或题目很多：daily 只保存索引，题目和批改拆到 `sessions/`、`reviews/`。
- 不管是否拆分，`study/index.json` 必须指向 latest daily、latest prompt、latest review。

### 21.3 Agent 操作要原子化

Codex 每次写数据时应遵守固定顺序：

1. 读取 `study/index.json`、`current.json`、`mastery.json` 和目标 daily。
2. 生成或更新目标文件。
3. 校验 JSON。
4. 写入 event log。
5. 更新 `next-agent-context.md`。
6. 最后更新 `study/index.json`。

如果中间失败，至少不要更新 `study/index.json`，避免前端指向半成品。

### 21.4 批改结果必须结构化

Review 结果不能只是一段自然语言。必须包含：

```json
{
  "overall": {
    "accuracy": 0.75,
    "can_advance": false,
    "summary": ""
  },
  "items": [
    {
      "exercise_id": "ex-001",
      "is_correct": false,
      "score": 0.4,
      "error_tags": ["particle", "tense"],
      "target_grammar": "",
      "user_answer": "",
      "correct_answer": "",
      "explanation": "",
      "retry_recommended": true
    }
  ],
  "mastery_updates": [],
  "next_review_queue": []
}
```

这样 Review 页、复习页、晋级规则都能消费同一份批改结果。

### 21.5 日语学习错因标签

为了让复习更有效，错题不应只存“错了”，还要存错因。建议固定错因 taxonomy：

- `particle`：助词错误，如 は/が/を/に/で。
- `conjugation`：动词、形容词变形错误。
- `tense_aspect`：时态、完成/进行等错误。
- `politeness`：です/ます、敬体、礼貌程度错误。
- `word_order`：语序或修饰关系错误。
- `vocabulary`：词汇选择错误。
- `kana_kanji`：假名、汉字、长音、促音错误。
- `grammar_pattern`：目标句型结构错误。
- `listening_mishear`：听力误听。
- `meaning_drift`：意思偏离。
- `naturalness`：语法可通但不自然。

Agent 批改时必须给每个错题打标签。复习页按标签生成复习，而不是只按题目复现。

### 21.6 掌握度不应只加分

掌握度需要允许下降或进入复习队列。

建议状态：

```text
new -> learning -> weak -> stabilizing -> mastered -> decayed
```

规则：

- 连续正确可以从 `weak` 进入 `stabilizing`。
- 隔一段时间后复测正确才进入 `mastered`。
- 已掌握内容如果再次连续出错，降级到 `decayed` 或 `weak`。
- 晋级新课后仍保留旧课复习任务，不把旧课直接关掉。

### 21.7 间隔复习队列

需要单独维护复习队列：

```text
study/state/review-queue.json
```

建议字段：

```json
{
  "items": [
    {
      "id": "rq-001",
      "kind": "grammar_point",
      "key": "lesson-7/pattern-x",
      "status": "due",
      "due_date": "2026-06-27",
      "interval_days": 1,
      "ease": 2.3,
      "last_result": "wrong"
    }
  ]
}
```

Agent 每次生成 daily packet 时，应先从 due items 中挑任务，再考虑新课内容。

### 21.8 学习材料也要结构化

每天不应只生成题目。学习材料也应作为数据进入 daily packet：

- `grammar_note`：语法说明。
- `contrast_note`：易混语法对比。
- `example_set`：例句组。
- `mini_dialogue`：小对话。
- `listening_script`：听力脚本。
- `shadowing_lines`：跟读句子。
- `production_prompt`：输出任务。

这能让前端先展示“学什么”，再进入答题，而不是每天直接考试。

### 21.9 用户自评和学习感受

前端提交时应让用户补充轻量自评：

- 今天难度：1 到 5。
- 哪题不确定。
- 哪个语法点感觉没懂。
- 是否太累、太简单或节奏合适。
- 是否想明天继续复习同一课。

这些自评会显著提高 Agent 下一轮计划质量。

### 21.10 Prompt 防漂移

生成提示词要强制包含：

- 允许读取的文件。
- 允许写入的文件。
- 禁止删除历史。
- 必须输出/修改的 schema。
- 批改和晋级规则路径。
- 如果信息不足，要写入 `needs_user_input`，不要猜。

否则几轮后 Agent 容易开始自由发挥，导致数据结构变形。

### 21.11 复习页和 Review 页的学习价值

复习页应优先解决“重复错”和“刚学完就忘”：

- 按错因聚合题目。
- 先解释共同错因，再给变体题。
- 同一语法点不要只重复原题，要生成最小变体。
- 每次复习结束给该语法点一个状态变化。

Review 页应帮助你决定“下一步学什么”：

- 是否该继续第 7 课。
- 哪些旧课需要插队复习。
- 过去一周听说读写是否失衡。
- 哪些语法点已经可以暂时移出复习队列。
- 下一次 Agent 生成任务应偏向输入、输出还是复盘。

### 21.12 可以删除的旧内容

如果以新流程为准，可以删除或重写：

- 旧 Dashboard 的手动计划配置。
- 前端 provider/API key 设置。
- `src/skills/generateExercise.js`。
- `src/skills/evaluateSentence.js`。
- 旧训练页里直接请求 LLM 的逻辑。
- 与新数据结构重复的旧 mastery 更新逻辑。

可以复用：

- `src/data/syllabus.json`。
- `src/data/types.json` 中有价值的题型描述。
- `aiPayloadValidators.js` 的结构校验思路。
- `mainStore.js` 中已有的 normalize 思路。
- 现有错题本里的历史数据。

## 22. 最终推荐架构

推荐最终形态：

```text
study/
  index.json
  state/
    current.json
    mastery.json
    review-queue.json
    promotion-rules.json
  daily/
    2026-06-26.json
  reviews/
    2026-06-26-review.json
  prompts/
    templates/
    generated/
    manifest.json
  context/
    next-agent-context.md
    snapshots/
  logs/
    agent-events.jsonl
```

前端最终只需要三个主页面：

- `/agent-study`：今天执行。
- `/agent-review-drill`：复习薄弱点。
- `/agent-progress-review`：看整体状态和计划。

Agent 最终只需要三类操作：

- `create_daily_packet`：生成今天任务。
- `review_submitted_packet`：批改并更新状态。
- `compress_context`：周期压缩上下文。

## 23. 建议实施阶段

### Phase 1: 文档和数据协议

- 新增本文件。
- 确定 `study/` 目录结构。
- 定义 mission、session、review、event log schema。

### Phase 2: Agent 生成器

- 增加一个脚本或 Codex 工作流说明，用于生成今日 mission/session/prompt。
- 生成后自动更新 `study/index.json`。
- 保证生成的练习字段兼容当前前端。

### Phase 3: 前端读取 Agent 数据

- Dashboard 显示今日 Agent mission。
- 支持打开 session 并保存答案。
- 显示批改提示词路径。

### Phase 4: Codex 批改写回

- Codex 按 prompt 读取 session。
- 写 review。
- 更新 `data.json`。
- 写 event log。

### Phase 5: 复盘与下一轮生成

- Codex 根据 review 生成下一轮 mission。
- WeeklyReview 读取 `study/logs` 和 `study/reviews`。
- 逐步减少前端运行时 LLM 依赖。

## 24. 下一步建议

下一步可以先实现 Phase 1 和 Phase 2 的最小闭环：

1. 创建 `study/` 目录和示例 schema。
2. 基于当前 `data.json` 生成一个真实的今日 mission/session/prompt。
3. 新增一个校验脚本，保证 JSON 能被前端消费。
4. 再改 Dashboard 读取这份 mission。

这样你很快就能体验目标流程，而不用先大规模重构旧训练逻辑。
