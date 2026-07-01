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
