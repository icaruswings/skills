# Mob-review Quality Evaluation Implementation Plan

> **For agentic workers:** Use the approved evaluation design and task-scoped independent implementation/validation. Keep shared interfaces below stable. Do not dispatch nested agents from implementers.

**Goal:** Measure tiered review quality against an all-Strong baseline and open a reviewable PR with reproducible evidence.

**Architecture:** A versioned fixture corpus provides public review briefs and private executable oracles. Native CLI adapters run isolated reviewers and Strong triage, while a separate scorer produces blinded provisional results and a human adjudication queue.

**Tech Stack:** Node.js built-ins, `node:test`, Claude Code CLI, Codex CLI, GitHub PR.

**Spec:** `docs/superpowers/specs/2026-10-29-mob-review-quality-design.md`

## Global constraints

- 24 cases: 16 pilot and 8 held out; 3 repetitions per provider/configuration/case.
- Same prompts, inputs, permissions, and schema in tiered/all-Strong arms.
- No source edits or tools inside review runs; no hidden truth in review prompts.
- Claude budget is the user's selected cap; Codex usage stays separate.
- All quality results remain provisional until human adjudication; no parity claim from a pilot.
- Preserve unrelated changes and the Box'd working tree. Commit only this task's files, push a new branch, and open/attach a draft PR.

## Shared fixture interface

Each `cases/*.mjs` default-exports an array. Each case has `id` (neutral C01..C24), `split` (`pilot`/`holdout`), `provenance` (`{kind,reference,description}`), `review` (`{filename,spec,before,after,context}`), `lenses` (`[{name,tier}]`, `expected` (`[{id,severity,lens,criterion}]`), and `verify()` returning `{before:boolean,after:boolean,evidence:string}`. Tiers are `economy`, `balanced`, `strong`; severities are `blocker`, `should-fix`, `optional`. Buggy cases must pass before and fail after; clean cases have empty expected findings and pass both. Files under `cases/` contain trusted fixture/oracle code, never model output.

## Review focus

- Hidden truth must never reach reviewers, including through filenames, fixture IDs, or enabled filesystem tools.
- A failed/partial run is unverified, never a zero-finding success; resumptions must preserve exact inputs/configuration hashes.
- Repeated samples of one case are correlated and cannot inflate unique-case confidence.
- Budget accounting must include failed calls and final triage; missing usage cannot be treated as free.
- Blinded automated matching must preserve severity and triage loss; unrecognized findings need human review.

## Task 1 — Corpus and executable ground truth

- [x] Write behavior tests that reject leaking identifiers, missing roles, invalid splits, vacuous oracles, and wrong clean/buggy before-after behavior.
- [x] Implement 12 backend/contract/infrastructure cases and 12 interface/product/staff/history cases under the shared interface.
- [x] Independently review the fixture contracts and run every oracle.

## Task 2 — Isolated, resumable live runner

- [x] Test prompt isolation, model selection, effective-model parsing, failed runs, resumptions, and budget accounting before implementation.
- [x] Implement explicit Claude/Codex adapters, structured findings, per-lens runs and Strong triage, manifest hashes, bounded subprocess timeouts, and usage capture.
- [x] Smoke-test one case on both providers before the full matrix; run the approved pilot and held-out matrix within cap.

## Task 3 — Blind scoring and evidence report

- [x] Test missed/retained blockers, clean-case alarms, incomplete matrices, duplicate findings, severity mismatches, and triage loss.
- [x] Implement blinded finding matching, provisional metrics, paired comparisons, and a human adjudication artifact.
- [x] Inspect actual misses and false alarms; document limitations and only change policy where evidence warrants it.

## Task 4 — Review and PR

- [x] Run the complete test suite, repository wiring check, and whitespace checks.
- [x] Perform independent Strong review of the final change and resolve actionable issues within this authorized implementation scope.
- [ ] Commit approved scope on the new branch, push it, create a draft PR with actual results/gaps, and attach it to this chat.

Execution evidence: `evals/mob-review/results/2026-10-29/REPORT.md`. Human adjudication remains pending; delivery is a draft PR.
