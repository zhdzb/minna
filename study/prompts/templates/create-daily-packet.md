# Codex Study Loop 提示词：create_daily_packet

## 目标

为当前学习日期创建一份新的每日学习包；如果流程需要，也一并准备下一份批改提示词，同时保持学习状态稳定、可追踪、可审计。

## 先读这些文件

- `study/index.json`
- `study/state/profile.json`
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `src/data/syllabus.json`
- `study/index.json` 中指向的最新 daily（如果存在）
- `study/index.json` 中指向的最新 review（如果存在）
- `study/logs/agent-events.jsonl`

## 允许写入

- `study/daily/YYYY-MM-DD.json`
- `study/prompts/generated/YYYY-MM-DD-review.md`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- `study/index.json`

## 硬规则

- 绝对不要覆盖或删除 `study/daily/`、`study/reviews/`、`study/logs/` 下的历史文件。
- 只为目标日期创建新 daily packet；如果当天文件已存在，停止并报告冲突。
- 所有 JSON 都必须可解析，并符合当前 schema。
- 以 `study/` 为事实来源，不要改动 `data.json`。
- 保持流程顺序：先复习薄弱点，再聚焦学习，再受控输出，最后自由输出。
- 题干、instruction、context_note、supporting_lines 和 vocab_hints 不得泄露参考答案、完整标准句或可直接拼出答案的日语词形；答案只能写入 `answer_reference`，供后续批改使用。
- 如果源数据不完整或有歧义，把不确定性写进 packet/context，不要擅自脑补。

## Daily Packet Schema 要求

新的 daily packet 必须满足当前 `dailyPacket` schema：

- 包含 `schema_version`、`revision`、`updated_at`、`id`、`date`、`status`、`created_at`
- 包含 `mission`、`tasks`、`study_materials`、`review_items`、`exercises`、`answers`、`self_assessment`、`correction`、`review_result`
- 初始状态必须是未批改状态，例如 `planned`、`learning` 或 `answering`
- 在 review 写入前，`correction.status` 保持 `pending`

## 内容质量要求

- 不要分配超出当日可完成范围的练习量。
- 每道题都必须绑定 lesson、skill、target grammar 或 review queue item。
- 不要为同一个目标语法重复生成相同题目。
- 每条新语法说明至少给 2 个例句。
- 输出题必须包含 `answer_reference` 或评分 rubric。
- 听力/跟读任务必须在 `study_materials` 里附带脚本。
- review drill 必须是变体题，不能只是把旧题原样再来一遍。

## 输出预期

写入 `study/daily/YYYY-MM-DD.json` 时：

- 根据 learner profile 和当前薄弱点决定范围
- 在引入新材料前，优先消费 `study/state/review-queue.json` 中已经到期的项目
- 尊重学习者的时间预算和课程边界
- `answers` 先填入以 exercise id 为键的空字符串
- `review_result` 保持为 `null`

写入 `study/prompts/generated/YYYY-MM-DD-review.md` 时：

- 为“已提交学习包批改”阶段准备下一条提示词
- 明确引用 daily packet 路径与 review schema 要求

写入 `study/context/next-agent-context.md` 时：

- 摘要新 daily packet 的要点
- 列出下一次 Codex 应优先读取的文件
- 保持简短、以路径为中心；不要粘贴整份 packet 全文

## 事件日志要求

所有成功写入完成后，向 `study/logs/agent-events.jsonl` 追加一条 JSONL 事件，至少包含：

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

事件类型可使用 `daily_packet_created` 或 `daily_packet_regenerated`。

## Index 更新要求

最后一步再更新 `study/index.json`；确保 daily packet、生成提示词、context、event log 都已经成功落盘。

## 最终检查

完成前确认：

1. 新 daily packet 路径唯一
2. 所有写入都停留在 `study/` 内
3. 没有覆盖任何历史 daily/review/log 文件
4. 输出结果可直接供前端渲染，并可进入后续结构化批改流程
