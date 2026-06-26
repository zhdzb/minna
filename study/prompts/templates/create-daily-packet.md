# Codex Study Loop Prompt: create_daily_packet

## Goal

Create one new daily study packet for the current study date, plus the next generated review prompt if needed by the workflow, while keeping the study state stable and auditable.

## Read These Files First

- `study/index.json`
- `study/state/profile.json`
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `src/data/syllabus.json`
- latest daily packet from `study/index.json` when present
- latest review result from `study/index.json` when present
- `study/logs/agent-events.jsonl`

## Allowed Writes

- `study/daily/YYYY-MM-DD.json`
- `study/prompts/generated/YYYY-MM-DD-review.md`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- `study/index.json`

## Hard Rules

- Never overwrite or delete historical files under `study/daily/`, `study/reviews/`, or `study/logs/`.
- Only create a new daily packet for the target date; if a packet for that date already exists, stop and report the conflict.
- Keep all JSON parseable and aligned with the current schema requirements.
- Treat `study/` as the source of truth; do not mutate `data.json`.
- Preserve the workflow order: review weak points first, then focused study, then controlled output, then freer output.
- If the source data is incomplete or ambiguous, write the uncertainty into the packet/context instead of guessing.

## Daily Packet Schema Requirements

The new daily packet must satisfy the current `dailyPacket` schema:

- include `schema_version`, `revision`, `updated_at`, `id`, `date`, `status`, `created_at`
- include `mission`, `tasks`, `study_materials`, `review_items`, `exercises`, `answers`, `self_assessment`, `correction`, `review_result`
- start with a non-reviewed state such as `planned`, `learning`, or `answering`
- keep `correction.status` as `pending` until a review is written

## Content Quality Requirements

- Do not assign more exercises than the available daily plan can realistically finish.
- Every exercise must bind to a lesson, skill, and target grammar or review queue item.
- Do not create duplicate exercises for the same target grammar and prompt.
- Every new grammar explanation must include at least 2 example sentences.
- Output exercises must include an `answer_reference` or scoring rubric.
- Listening or shadowing tasks must include script support in `study_materials`.
- Review drills must be variants, not identical repeats of prior prompts.

## Output Expectations

When writing `study/daily/YYYY-MM-DD.json`:

- use the learner profile and current weak points to choose scope
- pull due items from `study/state/review-queue.json` before adding new material
- respect the learner time budget and lesson boundaries
- populate `answers` with empty strings keyed by exercise id
- leave `review_result` as `null`

When writing `study/prompts/generated/YYYY-MM-DD-review.md`:

- prepare the next review instruction for the submitted-packet stage
- reference the exact daily packet path and the review schema expectations

When writing `study/context/next-agent-context.md`:

- summarize the new daily packet
- list the next files Codex should read
- keep it short and path-oriented; do not paste full packet contents

## Event Log Requirement

Append one JSONL event to `study/logs/agent-events.jsonl` after successful writes. The event must include:

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

Use an event such as `daily_packet_created` or `daily_packet_regenerated`.

## Index Update Requirement

Update `study/index.json` last, after the daily packet, generated prompt, context, and event log are all written successfully.

## Final Check

Before finishing:

1. confirm the new daily packet path is unique
2. confirm all writes stay under `study/`
3. confirm no historical daily/review/log file was overwritten
4. confirm the packet is ready for frontend rendering and later structured review
