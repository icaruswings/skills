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

"Available" is a fact, not a judgment: a subagent tool (Task, spawn_agent, or equivalent) is exposed in this session. Check the tool list; don't infer from the harness name.

| Subagents | Do this |
|---|---|
| Tool exposed, and the user already sanctioned subagents for this work | Dispatch one per lens. |
| Tool exposed, not sanctioned | Ask, after picking the mob and before any review work: "Mob review runs best as one subagent per lens, so no lens anchors another. Can I use subagents for this review? That's <N> agents: <lenses>. Otherwise I run each lens as a separate self-review pass." Then stop and wait for the answer. Asking is the normal path, not a failure — and mentioning the option while proceeding is not asking. |
| No tool exposed, or the user declined | Run an explicit separate pass per lens yourself. Don't ask — there's nothing to grant. |

Never spawn the mob unasked, and never start reviewing while the question is pending.

A review changes no files. Read, run, and inspect all you like, but the first edit waits for the user's answer to the question at the end of the report. This holds for your own uncommitted work too: a blocker in it means the change is not done, and saying so is the review's job. Fixing it is a separate job that the user assigns.

## Report

Produce exactly this, in this order:

1. **Mode** — the report's first line, always: `Mode: dispatched (<N> subagents)` or `Mode: self-review passes (<reason: user declined / no subagent tool exposed>)`. A report without a Mode line is an incomplete run; this line is what makes a quiet downgrade impossible.
2. **Lenses selected** — one line, each with the clause that triggered it. Name the ones you considered and skipped when the change looked like it might need them.
3. **Findings, grouped by lens** — each tagged `blocker`, `should-fix`, or `optional`, and numbered in one sequence across the whole report (`#1`, `#2`, …), so the user can name them back to you. A lens with nothing to say gets one line saying so.
4. **Verdict** — ship, ship after blockers, or needs a decision from the user.
5. **How to proceed** — the report's last line, always a question. Offer the choices in terms of the numbers above:

   > How do you want to proceed? Fix all, fix the blockers only (#1, #4), fix by number, or leave it with you?

   Then stop. The report is the deliverable; the answer decides what happens next. A report that ends on the verdict, or on a fix you already made, is an incomplete run.

`blocker` means data loss, a security hole, a broken contract, or a user-facing break. Everything a lens raises that isn't one of those is `should-fix` or `optional` — say which.

A blocker means the change is not done. It becomes done when someone fixes it or the user accepts it in so many words, and the verdict says which is still owed. Judging a blocker acceptable is the user's call, not yours.

## After the answer

Do what the user picked and nothing more: all, blockers only, the numbers they named, or nothing. A fix is a change, so re-run the lenses whose surfaces it touched, and report again in the same shape, question included.

## Scale to the change

When the change is only prose, comments, or formatting, with no behavior change: skip the panel, the subagent question, and the how-to-proceed question; do one self-check and report in a line or two — no Mode line needed. Everything else gets the table above.

An unfamiliar codebase raises the bar rather than lowering it — read enough surrounding code to judge the change in context before reporting, and say plainly which findings you couldn't verify.

## Done when

Every selected lens has reported, the verdict names which of the three it is, the turn ends on the how-to-proceed question, and no file has changed. Fixing starts only when the user answers.
