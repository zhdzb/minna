# Codex Study Loop 提示词：continue_agent_study

## 目标

在全新的 Codex 上下文中，先恢复 Agent Study 的真实状态，再只执行当前允许的下一步。不要依赖对话历史，也不要凭日期、文件名或用户描述猜测阶段。

## 先读这些文件

- `study/index.json`
- `study/context/next-agent-context.md`
- `study/state/profile.json`
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `src/data/syllabus.json`
- `study/logs/agent-events.jsonl`
- `study/index.json` 指向的最新 daily、review 和 prompt 文件（如存在）

## 预检

1. 解析并校验上述 JSON；确认 `index.json` 指向的文件存在且可解析。
2. 确认最新 review 的 `daily_id` 与最新 daily 的 `id` 是否匹配。
3. 若任一必需文件缺失、JSON 无法解析、schema 不匹配或引用关系矛盾，停止写入；报告具体路径和错误，不要猜测或修复历史文件。
4. 预检通过后，再根据下面规则确定唯一阶段。以文件实际状态为准，忽略本提示词中的旧快照。

## 阶段与动作

1. 没有最新 daily：执行 `study/prompts/templates/create-daily-packet.md`，生成新的学习包。
2. 最新 daily 的 `status` 为 `planned`、`learning`、`answering` 或 `draft`：当前处于学习与作答阶段。不要新建学习包、不要批改、不要修改学习状态；报告 daily 路径以及学习者还需要完成的动作。
3. 最新 daily 的 `status` 为 `submitted`，或其 `correction.status` 为 `pending`：执行 `study/prompts/templates/review-submitted-packet.md`，批改这份 daily。
4. 最新 daily 已批改，且 `study/state/review-queue.json` 有 `status: "due"` 的项目：当前处于复习巩固阶段。不要生成下一份 daily；报告应在 `/agent-review-drill` 完成的复习任务。
5. 最新 daily 已批改，且没有到期复习：执行 `study/prompts/templates/create-daily-packet.md`，生成下一份学习包。

## 共同约束

- 不要覆盖或删除 `study/daily/`、`study/reviews/`、`study/logs/` 中的历史文件。
- 不要调用前端 LLM 出题逻辑，也不要修改 `data.json`。
- 只有在所选阶段明确要求写入时才写文件；写入后更新 index、next-agent-context 和事件日志。
- 若执行了写入，最后运行 `npm run verify`；无法运行时说明原因。
