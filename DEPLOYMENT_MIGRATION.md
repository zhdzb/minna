# Deployment & Migration Guide

## 1) Required Environment Variables (Deployed Mode)

Set `APP_RUNTIME_MODE=deployed` in your deployed runtime (for example, Vercel).

LLM routing (server-side only):
- `DEFAULT_LLM_PROVIDER` (`gemini` or `openai`)
- `PLAN_LLM_PROVIDER` (optional override)
- `EXERCISE_LLM_PROVIDER` (optional override)
- `EVALUATION_LLM_PROVIDER` (optional override)
- `SUMMARY_LLM_PROVIDER` (optional override)
- `GEMINI_API_KEY` (required when any route uses Gemini)
- `GEMINI_MODEL` (optional, default from code)
- `OPENAI_API_KEY` (required when any route uses OpenAI-compatible)
- `OPENAI_MODEL` (optional, default from code)
- `OPENAI_BASE_URL` (optional, default from code)
- `OPENAI_REASONING_EFFORT` (optional, default from code)

Notes:
- Production keys must stay server-side environment variables only.
- Frontend must not require or persist production provider keys.

## 2) Cloud Persistence Expectations

Current deployed persistence path:
- Frontend uses `/api/state/load`, `/api/state/save`, `/api/state/patch`.
- Server persistence adapter is the contract boundary.

Current storage behavior:
- Deployed adapter keeps a server-memory path for runtime behavior compatibility.
- Browser `localStorage` still keeps local fallback state for UX continuity.

Target production behavior:
- Replace server-memory backend with real cloud storage (KV/DB/object storage) behind `src/server/persistence/serverPersistenceAdapter.js`.
- Do not change frontend contracts when swapping the backend.

## 3) `data.json` Backup Behavior

- `data.json` is still supported for local mode and migration safety.
- JSON export/import in UI remains the portable backup/migration mechanism.
- In deployed mode, runtime persistence must not depend on writing repository `data.json`.

## 4) Local vs Deployed Differences

Local mode (`APP_RUNTIME_MODE` unset or `local`):
- Uses local adapter behavior (`localStorage` + dev sync route).
- Can run with local development middleware in `vite.config.js`.

Deployed mode (`APP_RUNTIME_MODE=deployed`):
- Frontend persistence uses state APIs (`/api/state/*`).
- LLM flows should go through `/api/ai/*` routes.
- Settings UI should not request API keys from users.

## 5) Smoke Tests (Deployed API Routes)

After deployment, validate these endpoints:

1. `GET /api/state/load`
- Expect `200` and JSON `{ success: true, data: ... }`.

2. `POST /api/state/save`
- Send a normalized state payload.
- Expect `200` and JSON success.

3. `POST /api/ai/daily-plan`
- Send minimal valid plan-context payload.
- Expect structured enhancement JSON (`summary`, prompts, reminders).

4. `POST /api/ai/exercise-generate`
- Send valid lesson/training payload.
- Expect structured exercises JSON.

5. `POST /api/ai/exercise-evaluate`
- Send valid answers payload.
- Expect structured evaluation JSON.

6. `POST /api/ai/weekly-summary`
- Send weekly aggregate payload (including `weekly_stats`).
- Expect structured summary JSON (`overview`, `achievements`, `risks`, etc.).

## 6) Migration Checklist

1. Keep existing user data exportable before enabling deployed mode.
2. Deploy with server env vars configured first.
3. Verify `/api/state/*` and `/api/ai/*` smoke tests.
4. Confirm frontend settings no longer asks for production API keys.
5. Keep JSON import/export available as rollback/transfer path.
