# Codex Study Loop Prompt: compress_context

## Goal

Compress accumulated study context into a shorter next-step summary without losing the key state transitions, weak points, and required file references.

## Read These Files First

- `study/index.json`
- `study/context/next-agent-context.md` when present
- latest daily packet from `study/index.json` when present
- latest review result from `study/index.json` when present
- `study/state/current.json`
- `study/state/mastery.json`
- `study/state/review-queue.json`
- recent lines from `study/logs/agent-events.jsonl`

## Allowed Writes

- `study/context/snapshots/YYYY-Wxx-context.md`
- `study/context/next-agent-context.md`
- `study/logs/agent-events.jsonl`
- `study/index.json` only if the workflow requires the context path metadata to move

## Hard Rules

- Never overwrite or delete historical daily, review, or log files.
- Do not copy large raw JSON blocks into the compressed context.
- Keep the new context path-oriented and short enough for the next Codex turn.
- Preserve facts, decisions, open risks, and exact file references; compress narration, not evidence.
- If the latest state is ambiguous, point to the source files instead of inventing a summary.

## Compression Targets

The new `study/context/next-agent-context.md` should:

- summarize the latest daily status
- summarize the latest review outcome when present
- mention current lesson focus, weak points, and due review items
- list the next files that Codex should read
- stay within the intended context budget and avoid historical full-text duplication

The snapshot file should:

- capture the broader recent history being compressed away
- preserve references to daily, review, and state files
- provide enough traceability for future debugging

## Event Log Requirement

Append one JSONL event after the new snapshot/context are written. The event must include:

- `event_id`
- `time`
- `actor`
- `event`
- `input_files`
- `output_files`
- `summary`

Use an event such as `context_compressed`.

## Final Check

Before finishing:

1. confirm the compressed context is shorter than the prior working context
2. confirm the next-step instructions still name the required files
3. confirm the snapshot preserves the dropped historical detail
4. confirm no historical daily/review/log file was overwritten
