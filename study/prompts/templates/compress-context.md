# Codex Study Loop 提示词：compress_context

## 目标

把累积的学习上下文压缩成更短的下一步摘要，同时保留关键状态变化、薄弱点和必需文件引用。

## 先读这些文件

- `study/index.json`
- `study/context/next-agent-context.md`（如果存在）
- `study/index.json` 指向的最新 daily（如果存在）
- `study/index.json` 指向的最新 review（如果存在）
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/logs/agent-events.jsonl` 里最近几行

## 允许写入

- `study/context/snapshots/YYYY-Wxx-context.md`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- 只有在流程确实需要移动 context 路径元数据时，才允许写 `study/index.json`

## 硬规则

- 不要覆盖或删除历史 daily、review、log 文件。
- 不要把大块原始 JSON 直接复制进压缩后的上下文。
- 新的 context 要保持简短、路径导向，并控制在下一轮 Codex 可接受的上下文预算内。
- 保留事实、决策、未决风险和精确路径；压缩的是叙述，不是证据。
- 如果最新状态有歧义，明确指向源文件，不要自行补全总结。

## 压缩目标

新的 `study/context/next-agent-context.md` 应该：

- 概述最新 daily 的状态
- 如果存在，概述最新 review 的结果
- 说明当前课程重点、薄弱点、到期复习项
- 列出下一次 Codex 应优先读取的文件
- 保持短小，不重复历史全文

snapshot 文件应该：

- 保存这次被压缩掉的更完整近况
- 保留对 daily、review、state 文件的引用
- 为后续排查和回溯保留足够线索

## 事件日志要求

snapshot/context 写入完成后，追加一条 JSONL 事件，至少包含：

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

事件类型可使用 `context_compressed`。

## 最终检查

完成前确认：

1. 新 context 比旧工作上下文更短
2. 下一步指令仍然明确点出了必读文件
3. snapshot 保留了被折叠掉的历史细节
4. 没有覆盖任何历史 daily/review/log 文件
