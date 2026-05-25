# Repository Notes

## Scope

This repository is being refactored from a local-only Japanese study tool into a deployable study execution system with daily planning, cloud-ready persistence, and server-side LLM routing.

## Working Rules

- Keep local mode working while the migration is in progress.
- Treat deployed mode as a separate runtime path with stricter rules.
- Do not remove `data.json` import/export support until the cloud persistence flow is implemented and verified.

## Codebase Patterns

- `src/store/mainStore.js` is the main state normalization and persistence entry point.
- `src/store/trainingStore.js` owns active training session state and should stay focused on session flow.
- `src/utils/llmProvider.js` currently contains frontend-side provider behavior. Migrate to server-side routing incrementally, not in one sweeping rewrite.
- `src/utils/planRules.js` should stay as a pure rule module so plan generation can be tested independently from Pinia state and AI calls.
- Server-side provider modules should separate full internal config from a secret-free public status payload.
- Adapters that depend on runtime globals like `fetch` or `localStorage` should resolve them lazily so tests and alternate runtimes can override them after module import.
- Server-side helpers such as LLM request utilities and context snapshot builders should stay store-agnostic and accept plain data inputs.
- Dev-only API endpoints in `vite.config.js` should delegate into reusable modules under `src/server/` so deployed handlers can reuse the same route logic later.
- Exercise-generation and evaluation routes should reuse `src/utils/aiPayloadValidators.js` so server and frontend apply the same output validation contract.
- Summary-style routes should return a strict normalized JSON shape (not raw model text) so dashboard/report UIs stay stable across providers.
- Persistence API routes should go through `src/server/persistence/serverPersistenceAdapter.js` so runtime storage strategy (local file vs deployed memory/cloud) is switched in one place.
- Frontend persistence should use `createRuntimePersistenceAdapter()` so local mode keeps `data.json` compatibility while deployed mode targets `/api/state/*` contracts.
- Backup import/export flows should validate payload shape with `src/utils/backupPayload.js` before mutating store state.
- `vite.config.js` contains development-only middleware for `/api/save-progress` and `/api/llm`; do not mistake these for production-ready runtime APIs.
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
