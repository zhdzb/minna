# Repository Notes

## Scope

This repository is being refactored from a local-only Japanese study tool into a deployable study execution system with daily planning, cloud-ready persistence, and server-side LLM routing.

The active product flow is now the Agent Study workflow:

- `/agent-study`
- `/agent-review-drill`
- `/agent-progress-review`

## Working Rules

- Treat `Accepted` and `Implemented` documents under `specs/` as product
  behavior contracts. Read the relevant spec before changing a covered flow,
  and update its decision log when an approved behavior changes.
- Keep local mode working while the migration is in progress.
- Treat deployed mode as a separate runtime path with stricter rules.
- Do not remove `data.json` import/export support until the cloud persistence flow is implemented and verified.
- Do not overwrite historical files under `study/daily/`, `study/reviews/`, or `study/logs/` unless a task explicitly calls for generating new records there.

## Codebase Patterns

- `src/store/mainStore.js` is still the main persistence-facing frontend store.
- `src/store/trainingStore.js` is legacy session state. Do not expand it as the main Agent Study flow.
- `src/utils/planRules.js` should stay pure so planning rules can be tested independently.
- `src/server/agentStudy/` is the main home for file-backed study workflows, event logging, context generation, and writeback logic.
- `src/utils/agentStudySchema.js` and related validators should remain the shared contract for study documents.
- Server-side helpers such as request utilities, provider config, and context builders should stay store-agnostic and accept plain data inputs.
- Dev-only API endpoints in `vite.config.js` should delegate into reusable modules under `src/server/`.
- Persistence API routes should go through `src/server/persistence/serverPersistenceAdapter.js` so runtime storage strategy can switch in one place.
- Frontend persistence should use `createRuntimePersistenceAdapter()` so local mode keeps `data.json` compatibility while deployed mode can move to `/api/state/*`.
- Backup import/export flows should validate payload shape with `src/utils/backupPayload.js` before mutating store state.
- Exercise-generation and evaluation routes should reuse `src/utils/aiPayloadValidators.js` so server and frontend apply the same output validation contract.
- Summary-style routes should return normalized JSON shapes rather than raw model text.
- New schema-like state additions should be normalized with backward compatibility for existing local data.

## Quality Checks

- Use `npm run verify` before considering a story complete.
- For logic-only changes, add or update Vitest coverage.
- For UI stories, verify in the browser after code and tests pass.

## Deployment Direction

- Production LLM keys belong in server-side environment variables only.
- Browser `localStorage` may still hold non-secret UX preferences, but not production API keys.
- Cloud persistence is the target for deployed mode; `data.json` becomes a backup/import-export format.
- Deployed mode should not require writes to repository-root `data.json`; use a server persistence adapter mode that avoids runtime file writes.
