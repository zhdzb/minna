# Codex Study Loop

Codex Study Loop is the active study workflow for this repository. The app has been refactored away from the older browser-side AI trainer into a file-backed study execution system centered on:

- `Agent Study` for daily packet study and submission
- `Review Drill` for due review items and structured drill packets
- `Progress Review` for mastery, review queue, event log, and next-agent context

## Current Runtime

The current local runtime is a Vue + Vite app with development-only API middleware that reads and writes the `study/` workspace files.

Primary routes:

- `/agent-study`
- `/agent-review-drill`
- `/agent-progress-review`

The repository root still keeps `data.json` import/export compatibility during migration, but `study/` is the source of truth for the new workflow.

Accepted product behavior and cross-context decisions are archived under
[`specs/`](./specs/README.md). Implementation work should preserve accepted
spec boundaries or update the relevant decision log explicitly.

## Repository Layout

```text
study/
  index.json
  state/
  daily/
  reviews/
  review-drills/
  prompts/
  context/
  logs/

specs/
  README.md
  SPEC-NNN-short-title.md

src/
  components/
  server/agentStudy/
  utils/
  store/
```

Important areas:

- `study/`: durable Agent Study data and prompts
- `src/server/agentStudy/`: file store, workflows, event log, context tools, route handlers
- `src/components/AgentStudyWorkspace.vue`: main daily study UI
- `src/components/AgentReviewDrill.vue`: review drill UI
- `src/components/AgentProgressReview.vue`: study status dashboard

## Local Development

Install and run:

```bash
npm install
npm run dev
```

Default verification:

```bash
npm run verify
```

`npm run verify` runs the production build and the Vitest suite. Use it before considering a step complete.

## Migration Notes

- Do not overwrite historical files under `study/daily/`, `study/reviews/`, or `study/logs/`.
- Keep `data.json` import/export support until cloud persistence fully replaces it.
- Frontend browser-side LLM provider paths have been removed. New work should route through server-side helpers and the Agent Study workflow.

## Contributor Flow

When continuing development, start with:

1. `CODEX_STUDY_LOOP_TASKS.md`
2. `CODEX_STUDY_LOOP_DEVELOPMENT.md`
3. `AGENTS.md`

Then continue the first `pending` or `in_progress` step.

# example
打开页面
访问本地页面。你这边如果没开 dev server，就先运行 npm run dev，我刚才验证时用的是 http://127.0.0.1:4173。

从学习工作台开始
进入“学习工作台”。
这里会显示当前 daily packet。如果当前还没有 daily packet，说明还需要由系统或你下一步触发生成学习包。

做题
在练习区直接输入答案。
现在支持罗马音自动转假名，所以你可以直接打 watashi 这类输入。
填完后可以先“保存草稿”，确认后“提交学习包”。

提交后进入批改链路
提交后，页面会给出批改提示词路径，并支持复制提示词。
这一步的意思是：把这份提示词交给 Codex，继续执行批改与状态更新。

批改完成后看结果
批改结果会回写到系统里。
你回到“学习工作台”或“进度总览”，就能看到：
正确率
哪些语法点薄弱
是否建议推进
下一步该复习什么

做复习训练
如果系统生成了复习训练包，就去“复习训练”。
这里是针对错题或薄弱点的变体练习，不是单纯重复原题。

进入下一轮
看进度总览，继续下一次 daily packet 或复习循环。
