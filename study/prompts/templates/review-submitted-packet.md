# Codex Study Loop Prompt: review_submitted_packet

## Goal

Review one submitted daily packet, write a structured review result, update study state only where allowed by the workflow, and leave an auditable trail.

## Read These Files First

- `study/index.json`
- submitted daily packet referenced by `study/index.json` or explicitly provided
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/state/promotion-rules.json`
- `study/state/profile.json`
- `src/data/syllabus.json`
- latest review result from `study/index.json` when present
- `study/logs/agent-events.jsonl`

## Allowed Writes

- `study/reviews/YYYY-MM-DD-review.json`
- submitted daily packet that is being reviewed
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- `study/index.json`

## Hard Rules

- Never overwrite or delete historical review files or prior event-log lines.
- Only review a packet whose status is `submitted`.
- Do not advance lessons without evidence from the current structured review and `study/state/promotion-rules.json`.
- If an answer may have multiple valid expressions, use `acceptable_variants` or set `needs_user_input` instead of forcing a guess.
- If a judgment is uncertain, lower confidence and explain the uncertainty.
- Keep all state changes traceable through the written review and event log.

## Review JSON Requirements

The written review file must match the current `reviewResult` schema and include:

- `schema_version`, `revision`, `updated_at`, `id`, `daily_id`, `created_at`
- `overall`
- `items`
- `mastery_updates`
- `review_queue_updates`
- `promotion_decision`

For each item, include at least:

- `exercise_id`
- `is_correct`
- `score`
- `error_tags`
- `target_grammar`
- `user_answer`
- `correct_answer`
- `explanation`
- `retry_recommended`
- `confidence`
- `needs_user_input`
- `acceptable_variants`
- `manual_override`

## Required Error-Tag Taxonomy

Only use tags from this list unless the schema is expanded later:

- `particle`
- `conjugation`
- `tense_aspect`
- `politeness`
- `word_order`
- `vocabulary`
- `kana_kanji`
- `grammar_pattern`
- `listening_mishear`
- `meaning_drift`
- `naturalness`

## Scoring and Feedback Rules

- `q_fill`: use strict answer or option matching
- `q_translate`: score semantic accuracy, target grammar use, particle choice, conjugation, and naturalness
- `q_conversation`: score contextual fit, politeness, response intent, and naturalness
- `q_shadowing`: if direct evaluation is limited, note that it is self-assessment-driven
- `q_listening_keyword`: score keyword hit rate and mishearing patterns
- `q_pattern_substitution`: score structure retention and slot replacement accuracy

## Promotion and Review-Queue Rules

Use `study/state/promotion-rules.json` for promotion decisions.

Do not promote unless the evidence satisfies the configured thresholds.

For review queue updates, align with the simplified SRS rules:

- wrong: interval becomes `1`, status becomes `due`
- hard: interval becomes `max(1, floor(interval_days * 1.2))`
- good: interval becomes `ceil(interval_days * 2)`
- easy: interval becomes `ceil(interval_days * 3)`
- mastered items still remain eligible for long-term review

## Daily Packet Update Requirement

Update the reviewed daily packet so that:

- `correction.status` reflects the reviewed state
- `correction.review_file` points to the new review file
- `review_result` is stored or linked according to the active workflow design

## Event Log Requirement

Append one JSONL event after successful writes. The event must include:

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

Use an event such as `daily_packet_reviewed`.

## Index Update Requirement

Update `study/index.json` last, after the review file, daily packet updates, state updates, context update, and event log write all succeed.

## Final Check

Before finishing:

1. confirm the reviewed packet was actually `submitted`
2. confirm every incorrect answer has an explanation and taxonomy tag
3. confirm confidence and user-input flags were used honestly
4. confirm the promotion decision is justified by the current rules
5. confirm no historical review/log file was overwritten
