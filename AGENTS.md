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
