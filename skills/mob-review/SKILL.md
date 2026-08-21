---
name: mob-review
description: Use when finishing a meaningful change and before calling it done, merging, or opening a PR — feature work, backend or API changes, schema and migration changes, infrastructure changes, UI work, or security-sensitive changes. Also use when asked to review a diff, a PR, or someone else's work.
---

# Mob Review

Pressure-test evidence: [pressure-tests.md](./pressure-tests.md).

One reviewer finds one reviewer's bugs. A generic pass reports findings in the order it happened to notice them, which buries the blocker under the nitpick. Assemble a mob — the lenses that match what changed — run each as its own pass, and let each one rank its own findings.

## Pick the mob

Select every lens whose trigger matches the change. Most changes need two or three. Running all of them on everything is as wrong as running one.

| Lens | Select when the change touches | It checks |
|---|---|---|
| **Staff engineer** | any non-trivial code | correctness, edge cases, architecture boundaries, unnecessary complexity, test quality and coverage of the new behavior |
| **Security** | auth, permissions, user input, secrets, PII, external requests, dependencies, file uploads | authn/authz enforced server-side, default-deny, data exposure, injection, secret handling, dependency risk |
| **Product** | user-facing behavior, workflow, copy, scope | user value, workflow sanity, scope creep, naming and copy clarity, alignment with the agreed spec or issue |
| **Frontend & accessibility** | components, screens, forms, navigation, styling | keyboard operability, semantic elements and roles, focus management, contrast, responsive behavior, loading/error/empty states |
| **Data & contracts** | schema, migrations, API responses, event payloads, persisted shapes | backwards compatibility, migration safety and reversibility, query cost and indexes, retention and deletion |
| **Infrastructure** | IaC, CI/CD, networking, runtime config, deploys | least privilege, blast radius, rollout and rollback path, cost, secret storage, drift from what's committed |
| **Operability** | background jobs, integrations, payments, retries, anything that can fail silently | retry and timeout behavior, idempotency, partial failure; whether on-call can detect it, get enough context to triage, and remediate without reproducing it from scratch |

Add project-specific lenses to this roster in the project's `AGENTS.md` — a domain-expert lens (clinical, legal, financial, pedagogical) belongs wherever users would judge the domain rules, not just the code.

## Run them

One subagent per lens is the best way to run this: each lens gets independent context and can't be anchored by another lens's findings.

| Subagents | Do this |
|---|---|
| Available and already sanctioned for this work | Dispatch one per lens. |
| Available but not sanctioned — the user hasn't asked for them, or the harness wants them requested | Ask first. Name the lenses you'd dispatch and how many agents that is, and offer the self-review alternative. Wait for the answer. |
| Genuinely unavailable, or the user declined | Do an explicit separate pass per lens yourself, and say that's what you did. |

Never spawn the mob unasked, and never quietly downgrade to self-review — the user should know which one they got.

Re-review after a fix: a fix is a change, so re-run the lenses whose surfaces it touched.

## Report

Produce exactly this, in this order:

1. **Lenses selected** — one line, each with the clause that triggered it. Name the ones you considered and skipped when the change looked like it might need them.
2. **Findings, grouped by lens** — each tagged `blocker`, `should-fix`, or `optional`. A lens with nothing to say gets one line saying so.
3. **Verdict** — ship, ship after blockers, or needs a decision from the user.

`blocker` means data loss, a security hole, a broken contract, or a user-facing break. Everything a lens raises that isn't one of those is `should-fix` or `optional` — say which.

Blockers stop completion. They're resolved by fixing them or by the user explicitly accepting them — not by you deciding they're acceptable.

## Scale to the change

When the change is only prose, comments, or formatting, with no behavior change: skip the panel, do one self-check, report in a line or two. Everything else gets the table above.

An unfamiliar codebase raises the bar rather than lowering it — read enough surrounding code to judge the change in context before reporting, and say plainly which findings you couldn't verify.

## Done when

Every selected lens has reported, blockers are fixed or explicitly accepted, and the verdict names which of the three it is.
