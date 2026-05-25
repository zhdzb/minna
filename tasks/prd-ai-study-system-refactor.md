# PRD: AI Study System Refactor

## 1. Introduction/Overview

Refactor the current Minna no Nihongo practice app from a local exercise tool into a deployable AI-driven study execution system. The new system should give users a clear daily learning direction, prioritize listening and speaking for working in Japan, support cloud deployment on Vercel, protect API keys from public exposure, and persist learning context so AI-generated plans and summaries do not depend on fragile chat history.

The existing project already includes Vue 3, Pinia, Vue Router, Element Plus, exercise generation, answer evaluation, localStorage persistence, `data.json` sync, and a development LLM proxy. This refactor builds on those pieces instead of replacing the whole app at once.

## 2. Goals

- Provide a complete first release of the refactored learning system, not only a minimal prototype.
- Make the dashboard answer: "What should I study today?"
- Generate daily plans based on current lesson progress, foundation weakness, recent mistakes, available time, and listening/speaking priority.
- Rework training from generic exercises into ability-oriented tasks: grammar review, pattern substitution, listening keyword capture, shadowing, scenario speaking, and review.
- Support Vercel deployment with server-side API routes so LLM requests do not require the browser to directly access Gemini/OpenAI endpoints.
- Move real API keys out of frontend code, localStorage, and public files.
- Use cloud storage as the primary online data source, with `data.json` kept as an import/export backup format.
- Preserve AI context through structured learning records and request-time context assembly.
- Keep model provider configurable through server-side settings: Gemini, OpenAI-compatible API, or future providers.

## 3. User Stories

### US-001: Show today's mission on the dashboard

**Description:** As a learner, I want the home page to show today's study mission so that I know what to do immediately after opening the app.

**Acceptance Criteria:**

- [ ] Dashboard shows a primary "今日任务" section above existing statistics.
- [ ] The section displays today's goal, available minutes, required task count, optional task count, and completion progress.
- [ ] If no plan exists for today, the section shows controls to create one.
- [ ] Existing dashboard metrics remain accessible below the mission section.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Select today's available study time

**Description:** As a learner, I want to choose how much time I have today so that the system can create a realistic plan.

**Acceptance Criteria:**

- [ ] User can choose at least these presets: 30, 60, 90, 120 minutes.
- [ ] User can enter a custom number of minutes within a safe range, for example 15-240.
- [ ] Selected minutes are included in the plan generation request.
- [ ] The UI clearly differentiates selected and unselected time options.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Generate a structured daily study plan

**Description:** As a learner, I want the app to generate a daily plan from my progress and available time so that I can study with a clear sequence.

**Acceptance Criteria:**

- [ ] The system creates a plan with date, available minutes, plan type, focus lessons, required tasks, optional tasks, completion criteria, and AI summary.
- [ ] The plan includes at least one listening or speaking task unless the selected time is too short.
- [ ] The plan can include review tasks from lessons 1-22 when foundation rebuilding is enabled.
- [ ] The plan is persisted and reloads after page refresh.
- [ ] Regenerating today's plan requires explicit user confirmation if an incomplete plan already exists.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Add deterministic plan rules before AI enhancement

**Description:** As a developer, I need a rule engine that produces a stable plan skeleton so that AI output does not randomly change the learning structure.

**Acceptance Criteria:**

- [ ] Add a plan rule module that determines plan type, time allocation, task categories, and required/optional split.
- [ ] Rules support at least these plan types: foundation review, new lesson, listening/speaking, mistake review, weekend long session.
- [ ] Rules can run without calling an LLM.
- [ ] Unit tests cover at least 30, 60, 90, and 120 minute plans.
- [ ] Typecheck/build/test passes.

### US-005: Enhance daily plans with AI text and task content

**Description:** As a learner, I want AI to explain today's plan and generate concrete speaking/listening prompts so that the plan feels specific to my current needs.

**Acceptance Criteria:**

- [ ] AI receives a structured context payload, not raw app state dumps.
- [ ] AI returns JSON containing summary, focus notes, speaking prompts, listening prompts, and review reminders.
- [ ] The app validates the AI response before saving it.
- [ ] If AI fails, the rule-generated plan still remains usable.
- [ ] Typecheck/build/test passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Track daily task completion

**Description:** As a learner, I want to mark tasks complete so that I can see whether I finished today's plan.

**Acceptance Criteria:**

- [ ] Each daily task has status: pending, in_progress, completed, skipped.
- [ ] User can start, complete, or skip a task.
- [ ] Completing all required tasks marks the daily plan as completed.
- [ ] Skipped required tasks keep the plan incomplete and are visible in summary data.
- [ ] Completion state persists after refresh.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Add lesson mastery tracking

**Description:** As a learner, I want the system to track mastery by lesson and skill so that old weak lessons can be reviewed intentionally.

**Acceptance Criteria:**

- [ ] Add `lesson_mastery` data for grammar, listening, speaking, reading, and last reviewed time.
- [ ] Existing `progress.current_lesson` remains supported.
- [ ] Mastery data updates after completed plan tasks and training sessions.
- [ ] Missing mastery data is normalized for existing users without losing current progress.
- [ ] Unit tests cover normalization and updates.
- [ ] Typecheck/build/test passes.

### US-008: Add pattern mastery tracking

**Description:** As a learner, I want the system to know which sentence patterns I can recognize, substitute, or freely output so that plans target my real weaknesses.

**Acceptance Criteria:**

- [ ] Add `pattern_mastery` records with lesson, pattern id, recognition score, controlled output score, free output score, and last practiced time.
- [ ] Pattern records can be created from syllabus data and training results.
- [ ] Daily plan generation can use weak pattern records as input.
- [ ] Existing users without pattern data can still generate plans.
- [ ] Unit tests cover default and weak-pattern selection behavior.
- [ ] Typecheck/build/test passes.

### US-009: Add pattern substitution training

**Description:** As a learner who struggles to make my own sentences, I want guided sentence pattern substitution so that I can move from reading to speaking.

**Acceptance Criteria:**

- [ ] Add a training mode for pattern substitution.
- [ ] A task shows a base sentence, replacement slots, and an input field for the user's new sentence.
- [ ] The mode can be launched from a daily plan task.
- [ ] The result updates pattern mastery.
- [ ] The task supports speaking-oriented completion even if speech scoring is not implemented yet.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-010: Add listening keyword capture training

**Description:** As a learner focused on working in Japan, I want short listening tasks that train me to catch key information.

**Acceptance Criteria:**

- [ ] Add a training mode that plays or speaks a Japanese sentence using available browser speech support.
- [ ] User answers a keyword, intent, or missing information question.
- [ ] The mode supports lesson-scoped vocabulary and patterns.
- [ ] The result updates listening mastery.
- [ ] The UI has a replay control and a visible completion state.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-011: Add shadowing task support

**Description:** As a learner, I want daily shadowing tasks so that reading practice becomes speaking practice.

**Acceptance Criteria:**

- [ ] Add a task type for shadowing with sentence text, playback control, and self-rating.
- [ ] User can rate the attempt at least as easy, okay, hard.
- [ ] Self-rating affects speaking mastery.
- [ ] The task can appear in daily plans.
- [ ] Speech recognition is explicitly not required for this story.
- [ ] Typecheck/build passes.
- [ ] Verify in browser using dev-browser skill.

### US-012: Add scenario speaking training

**Description:** As a learner preparing for work in Japan, I want workplace and daily-life scenarios so that I can practice practical speaking.

**Acceptance Criteria:**

- [ ] Add a scenario speaking task type with situation, role, intent, allowed grammar scope, and answer input.
- [ ] The evaluator returns correctness, correction, explanation, and natural expression.
- [ ] Scenarios can be generated by AI using current lesson and previous lessons as scope.
- [ ] Results can be saved to mistakes or favorites.
- [ ] Typecheck/build/test passes.
- [ ] Verify in browser using dev-browser skill.

### US-013: Add cloud persistence as the online primary store

**Description:** As a deployed app user, I want my learning data saved in cloud storage so that Vercel deployments do not depend on writing to `data.json`.

**Acceptance Criteria:**

- [ ] Add a persistence abstraction with methods to load, save, and patch study state.
- [ ] Online mode uses a cloud-backed API endpoint as the primary persistence path.
- [ ] Local development can continue to use existing local persistence while migration is in progress.
- [ ] Runtime writes to root `data.json` are not required in deployed mode.
- [ ] Errors from cloud persistence are surfaced without losing in-memory progress.
- [ ] Typecheck/build/test passes.

### US-014: Keep `data.json` as import/export backup

**Description:** As a learner who values owning my data, I want to export and import my study data as JSON even after cloud storage becomes primary.

**Acceptance Criteria:**

- [ ] User can export current study state to a JSON backup file.
- [ ] User can import a valid JSON backup and merge or overwrite according to explicit confirmation.
- [ ] Import validates schema before modifying current state.
- [ ] `data.json` is documented as backup/import format, not online production storage.
- [ ] Typecheck/build/test passes.
- [ ] Verify in browser using dev-browser skill.

### US-015: Add Vercel server-side LLM proxy routes

**Description:** As a deployed app user, I want the app to call LLM APIs through Vercel server routes so that my browser does not need direct model API access.

**Acceptance Criteria:**

- [ ] Add server API routes for plan generation, exercise generation, evaluation, and weekly summary.
- [ ] Server routes read provider configuration from environment variables or server-side config.
- [ ] Frontend calls app-owned routes, not external LLM endpoints directly.
- [ ] Routes include timeout, retry, and structured error handling.
- [ ] Routes never return API keys or sensitive headers to the client.
- [ ] Typecheck/build/test passes.

### US-016: Remove frontend API key storage for deployed mode

**Description:** As a deployed app owner, I need real provider keys to stay out of browser storage and public code.

**Acceptance Criteria:**

- [ ] Deployed mode does not read `gemini_api_key` or `openai_api_key` from `localStorage`.
- [ ] Settings page no longer asks deployed users to paste production API keys into the browser.
- [ ] Existing local development behavior is either migrated or clearly gated behind local mode.
- [ ] `.env.example` documents required server variables without real secrets.
- [ ] Tests or static checks verify no production LLM request depends on browser-stored keys.
- [ ] Typecheck/build/test passes.
- [ ] Verify in browser using dev-browser skill.

### US-017: Add configurable provider routing

**Description:** As an app operator, I want to configure Gemini or OpenAI-compatible providers server-side so that the app can switch providers without frontend changes.

**Acceptance Criteria:**

- [ ] Server-side provider config supports at least Gemini and OpenAI-compatible Responses API.
- [ ] Provider can be selected through an environment variable or server-side setting.
- [ ] Task-specific routing is possible, for example one provider for plans and another for evaluation.
- [ ] Frontend receives only non-secret provider status, not keys.
- [ ] Unit tests cover provider selection.
- [ ] Typecheck/build/test passes.

### US-018: Persist AI context snapshots

**Description:** As a developer, I want AI requests to store their input context snapshots so that AI plans and summaries can be debugged and improved.

**Acceptance Criteria:**

- [ ] Plan and summary requests save a sanitized context snapshot.
- [ ] Snapshot includes current stage, target exam, priority skills, current lesson, active review lessons, weak patterns, recent task summary, provider, and prompt version.
- [ ] Snapshot excludes API keys and raw sensitive values.
- [ ] Snapshot can be inspected in development logs or persisted storage.
- [ ] Unit tests cover snapshot sanitization.
- [ ] Typecheck/build/test passes.

### US-019: Generate weekly AI review

**Description:** As a learner, I want a weekly AI review so that I understand what improved and what to focus on next.

**Acceptance Criteria:**

- [ ] Weekly review aggregates completed plans, skipped tasks, mastery changes, and recent mistakes.
- [ ] AI returns a structured weekly summary with wins, weak points, and next-week focus.
- [ ] Weekly review uses persisted records, not chat history.
- [ ] Failed AI generation does not delete the underlying weekly aggregate.
- [ ] Typecheck/build/test passes.
- [ ] Verify in browser using dev-browser skill.

### US-020: Add deployment documentation

**Description:** As a developer, I need clear deployment docs so that the app can be configured safely on Vercel.

**Acceptance Criteria:**

- [ ] Documentation explains required environment variables.
- [ ] Documentation explains cloud storage setup and `data.json` backup behavior.
- [ ] Documentation explains local development versus deployed mode.
- [ ] Documentation explicitly states that API keys must not be committed or stored in browser localStorage for production.
- [ ] Documentation includes a smoke test checklist for deployed API routes.

## 4. Functional Requirements

- FR-1: The system must show a daily mission section as the top dashboard priority.
- FR-2: The system must allow the user to choose available study time before generating a daily plan.
- FR-3: The system must generate daily plans with structured fields: date, minutes, plan type, focus lessons, tasks, completion criteria, and summary.
- FR-4: The system must include deterministic plan rules that work without AI.
- FR-5: The system must use AI only as an enhancement layer for explanation, prompts, summaries, and dynamic task content.
- FR-6: The system must support daily task statuses: pending, in_progress, completed, skipped.
- FR-7: The system must track lesson mastery across grammar, listening, speaking, and reading.
- FR-8: The system must track pattern mastery across recognition, controlled output, and free output.
- FR-9: The system must support pattern substitution training.
- FR-10: The system must support listening keyword capture training.
- FR-11: The system must support shadowing tasks with self-rating.
- FR-12: The system must support scenario speaking tasks oriented toward work and daily life in Japan.
- FR-13: The system must support cloud persistence as the primary storage mechanism in deployed mode.
- FR-14: The system must keep JSON import/export as a user-owned backup path.
- FR-15: The system must not depend on writing root `data.json` in deployed mode.
- FR-16: The system must route production LLM calls through app-owned server API routes.
- FR-17: The system must keep real LLM API keys on the server side only.
- FR-18: The system must support server-side configurable provider routing for Gemini and OpenAI-compatible APIs.
- FR-19: The system must persist sanitized AI context snapshots for plan and review generation.
- FR-20: The system must generate weekly summaries from persisted learning records.
- FR-21: The system must normalize old local data so existing `progress`, `mistakes_book`, and backups are not lost.
- FR-22: The system must expose clear user-facing errors when plan generation, storage, or AI routes fail.

## 5. Non-Goals (Out of Scope)

- No full multi-user account system unless cloud storage selection requires minimal identity support.
- No paid subscription or billing system.
- No real-time human tutor or live conversation room.
- No mandatory speech recognition scoring in the first release.
- No automatic JLPT N2 full exam simulator in this release.
- No replacement of the entire Vue app shell unless required by deployment constraints.
- No production API key entry through the browser settings page.
- No guarantee that Vercel fixes every possible provider network restriction; the requirement is to route through server-side functions and handle failures clearly.

## 6. Design Considerations

- Reuse the existing Vue 3, Pinia, Vue Router, and Element Plus structure.
- Keep the current dashboard information, but visually demote statistics below today's mission.
- The daily mission UI should feel like a work-focused study console: direct, clear, and low-friction.
- Avoid making users manually configure every study decision each day. The main user action should be choosing time and starting the plan.
- Training tasks launched from the daily plan should return cleanly to the plan progress view.
- Settings should separate local development options from production-safe deployment status.
- UI stories must be verified visually because this app's learning flow depends heavily on clarity and confidence.

## 7. Technical Considerations

- Current local persistence lives in `src/store/mainStore.js` through `localStorage`, `/data.json`, and `/api/save-progress`.
- Current development LLM proxy exists in `vite.config.js` under `/api/llm`.
- Current frontend provider configuration exists in `src/utils/llmProvider.js`, `config.js`, and `src/components/Settings.vue`.
- Deployed mode should introduce server API routes instead of relying on Vite development middleware.
- A persistence adapter should be introduced before replacing all store calls, so the migration can be staged.
- Cloud storage should be treated as primary online storage. `data.json` should remain a backup and migration format.
- AI context should be assembled from structured records each request. It must not rely on chat history.
- Prompt versions should be stored with context snapshots to support future debugging.
- Provider configuration must be server-side and configurable, with Gemini and OpenAI-compatible APIs supported.
- Existing tests around `generateExercise`, `evaluateSentence`, `mainStore`, and `trainingStore` should be expanded rather than discarded.

## 8. Success Metrics

- A user can open the app and understand today's required work within 10 seconds.
- A user can generate a daily plan in under 3 interactions.
- At least 80% of generated plans include a listening or speaking task.
- Existing local progress and mistakes remain available after migration.
- No production LLM API key appears in browser localStorage, built frontend assets, or public config files.
- Deployed LLM calls go through app-owned server routes.
- Weekly review can be generated from persisted records after at least 3 completed daily plans.
- Build and test commands pass after the first release refactor.

## 9. Open Questions

- Which cloud storage should be selected for the first implementation: Vercel Postgres, Supabase, Neon, KV, or another provider?
- Does the deployed version need authentication immediately, or can it initially target a single private user deployment?
- Should local mode continue allowing browser-entered API keys for development, or should all modes move to `.env.local`?
- Should the first release include an import wizard for existing `data.json`, or can migration happen automatically on first load?
- Should weekly AI review be visible on the dashboard, or should it live on a separate review page?
