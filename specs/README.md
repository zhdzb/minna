# Product Specifications

`specs/` archives product and behavior decisions that must remain stable across
implementation work, refactors, and new Codex contexts. Specs describe the
expected behavior; task lists and implementation plans describe how and when
that behavior is delivered.

## Status

- `Draft`: under discussion and not yet a product contract.
- `Accepted`: approved product behavior; implementation may still be pending.
- `Implementing`: accepted and currently being implemented.
- `Implemented`: shipped and verified against the acceptance criteria.
- `Superseded`: replaced by another spec and kept only for history.

Changing an `Accepted` or `Implemented` decision requires updating the spec's
decision log. Do not silently rewrite the original intent.

## Naming

Use `SPEC-NNN-short-title.md`. Each spec should include:

- metadata and status;
- problem statement and goals;
- explicit product decisions and boundaries;
- data and interaction contracts where relevant;
- acceptance criteria;
- rollout, migration, and decision history.

## Index

| ID | Title | Status | Updated |
| --- | --- | --- | --- |
| [SPEC-001](./SPEC-001-review-results-and-mistake-workflows.md) | 批改结果阅读与错题训练 | Implemented | 2026-08-26 |
