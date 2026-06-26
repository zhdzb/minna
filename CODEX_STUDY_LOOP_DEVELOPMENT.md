# Codex Study Loop Development Guide

更新时间：2026-06-26

## 1. 开发目标

本项目后续重构为一个“Codex 参与编排的日语学习执行系统”。

新的主流程不是前端实时调用 LLM，而是：

1. Codex 读取仓库内学习状态。
2. Codex 生成当天学习包、题目、复习内容和批改提示词。
3. 前端读取结构化文件并渲染学习页面。
4. 用户在前端学习、复习、答题。
5. 用户点击提交，前端把答案写回仓库文件。
6. 用户把页面给出的批改提示词交给 Codex。
7. Codex 批改、更新掌握度、写入事件日志，并生成下一轮上下文。

开发时可以任意删除旧页面、旧技能、旧前端 provider 逻辑。旧项目只按可复用价值处理，不再作为必须兼容的运行系统。

## 2. 旧规则的取舍

保留这些旧规则：

- 结构化数据必须可校验。
- 学习状态更新必须可追溯。
- 前端只消费稳定 JSON，不直接消费模型自然语言。
- 日语题目生成和批改要保留明确 schema。
- 导入/备份思路保留，但 `data.json` 不再是新流程唯一真实来源。
- 服务端或本地 API 逻辑应放在 `src/server/` 下的可复用模块，不写死在 `vite.config.js`。

废弃或降级这些旧规则：

- 不再要求旧 Dashboard、旧训练页、旧 Settings 继续可用。
- 不再要求 `src/skills/generateExercise.js` 和 `src/skills/evaluateSentence.js` 继续存在。
- 不再要求浏览器持有 API key。
- 不再以 `mainStore` 作为所有新学习数据的唯一入口。
- 不再保留前端直接调用 LLM 的产品路径。

新规则：

- `study/` 是新学习系统的真实数据域。
- Codex 负责生成、批改、压缩上下文。
- 前端负责展示、收集答案、提交到本地文件。
- 每次 Agent 行为必须留下 event log。
- 每次批改必须产生结构化 review。

## 3. 最终目录结构

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
      create-daily-packet.md
      review-submitted-packet.md
      compress-context.md
    generated/
      2026-06-26-review.md
    manifest.json
  context/
    next-agent-context.md
    snapshots/
      2026-W26-context.md
  logs/
    agent-events.jsonl
```

## 4. 数据真实来源

新系统的真实状态来源按职责划分：

- `study/state/current.json`：当前学习摘要，供前端和 Codex 快速读取。
- `study/state/mastery.json`：掌握度、当前课次、晋级状态的真实来源。
- `study/state/review-queue.json`：间隔复习队列。
- `study/state/promotion-rules.json`：晋级规则。
- `study/daily/*.json`：每天的学习事实包。
- `study/reviews/*.json`：批改事实。
- `study/logs/agent-events.jsonl`：审计日志。
- `study/context/next-agent-context.md`：下一次交给 Codex 的上下文入口。

`data.json` 只作为：

- 初始迁移来源。
- 旧数据备份。
- 可选导出格式。

新流程中不要同时把 `data.json` 和 `study/state/mastery.json` 当成同等真实来源。

## 5. Daily Packet

每日学习包是前端主入口。

文件路径：

```text
study/daily/YYYY-MM-DD.json
```

状态流：

```text
planned -> learning -> answering -> submitted -> reviewed -> reflected
```

最小结构：

```json
{
  "schema_version": 1,
  "id": "daily-2026-06-26",
  "date": "2026-06-26",
  "status": "planned",
  "created_at": "2026-06-26T00:00:00+08:00",
  "updated_at": "2026-06-26T00:00:00+08:00",
  "mission": {
    "title": "第 7 课基础重建",
    "plan_type": "review_then_output",
    "available_minutes": 60,
    "focus_lessons": [7],
    "goals": []
  },
  "tasks": [],
  "study_materials": [],
  "review_items": [],
  "exercises": [],
  "answers": {},
  "self_assessment": {
    "difficulty": null,
    "uncertain_exercise_ids": [],
    "confusing_points": [],
    "pace": "",
    "note": ""
  },
  "correction": {
    "status": "pending",
    "prompt_file": "",
    "review_file": ""
  },
  "review_result": null
}
```

规则：

- 一天 1 到 2 次短练习时，题目和答案可以直接放进 daily packet。
- 一天多 session 或题量很大时，daily packet 只保留索引，具体内容拆到 `sessions/` 或 `reviews/`。
- 不论是否拆分，`study/index.json` 必须指向最新 daily、prompt、review。

## 6. 学习材料结构

每天不应该直接进入考试。Daily Packet 必须支持学习材料：

```json
{
  "id": "material-001",
  "type": "grammar_note",
  "lesson": 7,
  "title": "语法说明标题",
  "content": "中文说明，必要时包含日语例句",
  "examples": [
    {
      "ja": "",
      "zh": "",
      "note": ""
    }
  ]
}
```

允许的 `type`：

- `grammar_note`：语法说明。
- `contrast_note`：易混语法对比。
- `example_set`：例句组。
- `mini_dialogue`：小对话。
- `listening_script`：听力脚本。
- `shadowing_lines`：跟读材料。
- `production_prompt`：输出任务。

## 7. 练习题结构

新系统题型应先少后多，优先支持：

- `q_fill`：选择/填空。
- `q_translate`：中译日输出。
- `q_conversation`：场景对话补全。
- `q_shadowing`：跟读任务。
- `q_listening_keyword`：听力关键词。
- `q_pattern_substitution`：句型替换。

通用字段：

```json
{
  "id": "ex-001",
  "type": "q_translate",
  "lesson": 7,
  "target_grammar": "N で V",
  "prompt": "请翻译成日语",
  "vocab_hints": [],
  "answer_reference": "",
  "metadata": {
    "source": "codex",
    "difficulty": "foundation",
    "skill": "output"
  }
}
```

前端必须能在没有标准答案展示的情况下让用户答题，标准答案用于 Codex 批改，不直接暴露为主流程答案。

## 8. Review 结果结构

批改结果必须结构化，不能只写自然语言。

```json
{
  "schema_version": 1,
  "id": "review-2026-06-26",
  "daily_id": "daily-2026-06-26",
  "created_at": "2026-06-26T00:00:00+08:00",
  "overall": {
    "accuracy": 0.75,
    "can_advance": false,
    "summary": "",
    "next_focus": []
  },
  "items": [
    {
      "exercise_id": "ex-001",
      "is_correct": false,
      "score": 0.4,
      "error_tags": ["particle", "tense_aspect"],
      "target_grammar": "",
      "user_answer": "",
      "correct_answer": "",
      "explanation": "",
      "retry_recommended": true
    }
  ],
  "mastery_updates": [],
  "review_queue_updates": [],
  "promotion_decision": {
    "can_advance": false,
    "reason": ""
  }
}
```

## 9. 日语错因标签

固定错因 taxonomy：

- `particle`：助词错误。
- `conjugation`：动词/形容词变形错误。
- `tense_aspect`：时态、完成、进行等错误。
- `politeness`：礼貌体、敬体、语气错误。
- `word_order`：语序或修饰关系错误。
- `vocabulary`：词汇选择错误。
- `kana_kanji`：假名、汉字、长音、促音错误。
- `grammar_pattern`：目标句型结构错误。
- `listening_mishear`：听力误听。
- `meaning_drift`：意思偏离。
- `naturalness`：语法可通但不自然。

Codex 批改时必须给错题打标签。复习页根据标签和语法点生成变体题。

## 10. Mastery 状态

掌握度不能只增加，也要允许降级。

状态：

```text
new -> learning -> weak -> stabilizing -> mastered -> decayed
```

规则：

- 初次学习进入 `learning`。
- 出错进入 `weak`。
- 连续正确可进入 `stabilizing`。
- 隔一段时间复测仍正确，进入 `mastered`。
- 已掌握内容再次连续出错，进入 `decayed` 或 `weak`。
- 晋级新课后，旧课仍可能进入复习队列。

## 11. Review Queue

`study/state/review-queue.json` 用于间隔复习。

```json
{
  "schema_version": 1,
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

Daily Packet 生成顺序：

1. 先处理 due review queue。
2. 再处理当前课次薄弱点。
3. 最后才安排新知识。

## 12. Promotion Rules

`study/state/promotion-rules.json` 定义晋级条件。

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

Codex 只有在 review 明确满足规则时才能更新 `current_lesson`。

## 13. Prompt 规则

提示词分模板和生成稿。

模板：

```text
study/prompts/templates/create-daily-packet.md
study/prompts/templates/review-submitted-packet.md
study/prompts/templates/compress-context.md
```

生成稿：

```text
study/prompts/generated/YYYY-MM-DD-review.md
```

每个提示词必须包含：

- 允许读取的文件。
- 允许写入的文件。
- 禁止删除历史记录。
- 必须遵守的 schema。
- 批改标准和晋级规则路径。
- 不确定时写入 `needs_user_input`，不要猜。
- 完成后追加 event log。

## 14. Agent 操作

只定义三类正式 Agent 操作。

### 14.1 create_daily_packet

输入：

- `study/index.json`
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `src/data/syllabus.json`
- 最近 reviews 和 daily packets

输出：

- 新的 `study/daily/YYYY-MM-DD.json`
- 新的 generated prompt
- 更新 `study/context/next-agent-context.md`
- 追加 event log
- 更新 `study/index.json`

### 14.2 review_submitted_packet

输入：

- 已提交的 daily packet
- mastery
- review queue
- promotion rules
- syllabus

输出：

- `study/reviews/YYYY-MM-DD-review.json`
- 更新 mastery
- 更新 review queue
- 更新 current
- 更新 next-agent-context
- 追加 event log
- 更新 index

### 14.3 compress_context

触发条件：

- 每周一次。
- 或每 5 次 session。
- 或 `study/context/next-agent-context.md` 过长。

输出：

- `study/context/snapshots/YYYY-Wxx-context.md`
- 精简后的 `next-agent-context.md`
- 追加 event log

## 15. 原子写入顺序

Agent 或本地脚本写数据时必须遵守：

1. 读取当前 index 和相关状态。
2. 写目标业务文件。
3. 校验 JSON。
4. 写 event log。
5. 写 next-agent-context。
6. 最后更新 `study/index.json`。

如果中间失败，不更新 `study/index.json`。

## 16. 前端页面

最终只保留三个主页面。

### 16.1 AgentStudyWorkspace

路由：

```text
/agent-study
```

职责：

- 读取 latest daily packet。
- 展示今日计划。
- 展示学习材料。
- 展示练习题。
- 保存草稿。
- 提交答案到仓库。
- 复制批改提示词。
- 刷新批改结果。

### 16.2 AgentReviewDrill

路由：

```text
/agent-review-drill
```

职责：

- 展示 due review queue。
- 展示 Agent 生成的错题变体。
- 提交复习结果。
- 显示该语法点状态变化。

### 16.3 AgentProgressReview

路由：

```text
/agent-progress-review
```

职责：

- 展示当前课次。
- 展示 mastery。
- 展示计划完成情况。
- 展示高频错因。
- 展示晋级条件。
- 展示 event log 时间线。
- 展示 next-agent-context。

## 17. 本地 API

本地开发模式需要这些 API：

```text
GET  /api/agent-study/latest
POST /api/agent-study/daily/save
POST /api/agent-study/daily/submit
GET  /api/agent-study/review/latest
```

实现要求：

- Vite 中间件只做适配。
- 业务逻辑放在 `src/server/agentStudy/`。
- 写入前校验 schema。
- 提交动作必须追加 event log。

## 18. 可删除内容

新流程跑通后可以删除：

- 旧 Dashboard 手动计划配置。
- 旧 TrainingEngine 的 LLM 直接调用逻辑。
- 前端 provider/API key 设置。
- `src/skills/generateExercise.js`。
- `src/skills/evaluateSentence.js`。
- 与新 mastery 重复的旧更新逻辑。

可复用：

- `src/data/syllabus.json`
- `src/data/types.json`
- `src/utils/aiPayloadValidators.js` 的校验思路
- `src/store/mainStore.js` 的 normalization 思路
- `data.json` 中已有错题和历史进度

## 19. 开发阶段

### Phase 1: 数据协议

- 创建 `study/` 目录。
- 创建示例 `index.json`、`current.json`、`mastery.json`、`review-queue.json`、`promotion-rules.json`。
- 创建 JSON 校验模块。
- 添加 Vitest 覆盖。

验收：

- 所有示例 JSON 可校验。
- `npm run verify` 通过。

### Phase 2: Agent 文件工作流

- 创建 prompt templates。
- 创建 next-agent-context 生成逻辑。
- 创建 event log 追加工具。
- 创建 daily packet 示例生成脚本或手动生成规范。

验收：

- 能生成一个可被前端读取的 daily packet。
- 能生成可复制给 Codex 的 review prompt。

### Phase 3: AgentStudyWorkspace

- 新建 `/agent-study` 页面。
- 渲染 latest daily packet。
- 支持保存草稿和提交答案。
- 支持复制 review prompt。

验收：

- 用户能完成一次学习包。
- 提交后文件状态变为 `submitted`。

### Phase 4: Review 写回

- 根据 submitted daily packet 生成 review。
- 更新 mastery。
- 更新 review queue。
- 更新 next-agent-context。

验收：

- Review 页能显示批改结果。
- Mastery 可解释地变化。

### Phase 5: 复习和整体 Review

- 新建 `/agent-review-drill`。
- 新建 `/agent-progress-review`。
- 按错因和 review queue 生成复习。

验收：

- 能看到薄弱点。
- 能看到晋级条件。
- 能看到下一次建议。

### Phase 6: 删除旧逻辑

- 删除旧前端 LLM provider 路径。
- 删除 `src/skills/*`。
- 删除或重写旧 Dashboard/TrainingEngine。

验收：

- 新流程不依赖旧技能。
- 项目入口清晰。

## 20. 开发硬规则

- 不写不可解析 JSON。
- 不覆盖历史 daily/review/log。
- 不在没有 review 证据时推进课次。
- 不让前端直接依赖 Codex 的自然语言输出。
- 不把 API key 放进浏览器配置。
- 不让 daily packet 承担长期数据库职责。
- 不让 mastery 只升不降。
- 不让复习页只重复原题，必须支持变体题。
- 不让 prompt 自由漂移，必须引用模板和 schema。

## 21. 第一批开发任务

建议正式开发从这些任务开始：

1. 新建 `study/` 目录和 seed 数据。
2. 新建 `src/server/agentStudy/` 数据读写模块。
3. 新建 schema 校验工具和测试。
4. 新建 prompt templates。
5. 新建 `/agent-study` 页面。
6. 实现 submit 写回 daily packet。
7. 用一份真实 daily packet 跑通“前端答题 -> 提交 -> Codex 批改提示词”。

