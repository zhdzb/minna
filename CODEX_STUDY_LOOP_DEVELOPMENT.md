# Codex Study Loop Development Guide

Updated: 2026-06-26

## 1. Goal

This repository is being refactored into a Codex-assisted Japanese study execution system.

The new primary workflow is:

1. Codex reads `study/` state and recent history.
2. Codex creates or updates a structured daily packet and review prompt.
3. The frontend renders stable JSON data instead of raw model text.
4. The learner studies in the browser and submits answers.
5. Review results write back into `study/` state, review queue, event log, and next-agent context.

The old browser-side AI training flow is no longer the main product path.

## 2. Main Principles

Keep these principles:

- Structured data must validate cleanly.
- Study state updates must be traceable.
- Frontend UIs should consume normalized JSON, not raw natural-language model output.
- Review outputs must be schema-based.
- `data.json` remains an import/export compatibility format during migration.
- Reusable business logic should live under `src/server/`.

Deprecated assumptions:

- Old dashboard and old training pages do not need to remain first-class entry points.
- Browser-held API keys are not the long-term architecture.
- Legacy `src/skills/*` frontend generation/evaluation logic is no longer part of the main flow.

## 3. Source of Truth

The new runtime centers on `study/`:

- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `study/state/profile.json`
- `study/daily/*.json`
- `study/reviews/*.json`
- `study/review-drills/*.json`
- `study/logs/agent-events.jsonl`
- `study/context/next-agent-context.md`

`data.json` is retained for backup/import-export and migration support, but it is not the primary source of truth for the new workflow.

## 4. Primary Frontend Pages

Only three pages are the main flow:

### `/agent-study`

- Load the latest daily packet
- Render study materials and exercises
- Save draft answers
- Submit daily answers
- Display latest review and generated prompt references

### `/agent-review-drill`

- Show due review queue items
- Render structured review drill packets
- Save and submit drill answers

### `/agent-progress-review`

- Show learner profile, current lesson, mastery, review queue summary, promotion status, recent events, and next-agent context

## 5. Core Data Rules

- Every durable JSON document should include `schema_version`, `revision`, and `updated_at`.
- Writes must use revision checks where frontends and local tools can race.
- Do not overwrite historical `daily`, `review`, or `log` files.
- `study/index.json` is an entry file, but it must remain rebuildable from disk.
- `next-agent-context.md` should stay concise and reference files rather than duplicating them.

## 6. Review and Progress Logic

- Review outputs must be normalized and structured.
- Mastery can improve or decay; it is not monotonic.
- Review queue scheduling follows simplified wrong/hard/good/easy interval rules.
- Promotion to a new lesson requires explicit review evidence.
- Manual review overrides must remain auditable through the event log.

## 7. API Shape

The local development runtime exposes development-only routes through Vite middleware, backed by reusable server modules:

- `GET /api/agent-study/latest`
- `POST /api/agent-study/daily/save`
- `POST /api/agent-study/daily/submit`
- `GET /api/agent-study/review/latest`
- `GET /api/agent-study/progress`
- `GET /api/agent-study/review-drill/latest`

Keep route glue thin and move business logic into `src/server/agentStudy/`.

## 8. Legacy Cleanup Direction

Legacy training surfaces may be removed when they no longer support the new system.

Already removed or deprecated:

- old frontend LLM provider path
- legacy `src/skills/*`
- old Dashboard and TrainingEngine runtime path

Still intentionally retained where needed:

- `data.json` compatibility
- persistence import/export support
- reusable syllabus, types, validators, and store normalization ideas

## 9. Completion Standard

A development step is complete when:

- the requested files or behaviors are implemented,
- `npm run verify` passes for code changes,
- UI changes are checked locally when practical,
- task status and completion notes are written back into `CODEX_STUDY_LOOP_TASKS.md`.
