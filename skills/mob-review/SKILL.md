---
name: mob-review
description: Use when finishing a meaningful change and before calling it done, merging, or opening a PR — feature work, backend or API changes, schema and migration changes, infrastructure changes, UI work, or security-sensitive changes. Also use when asked to review a diff, a PR, a spec, a plan, or someone else's work.
---

# Mob Review

Assemble a mob of the lenses that match what changed, run each as its own pass, and let each rank its own findings.

Before you pick lenses, read `.agents/project.md` in the repo root if it exists. Its `## mob-review` section, like a mob-review rule in `AGENTS.md`, can add lenses (a domain expert, for example) and set a [standing policy](#standing-policy). Its `verify` key is the command a change must pass.

## Pick the depth

Pick the depth from what the change touches, before you dispatch anything. The same change always gets the same depth: don't scale it to the size of the diff or to how busy anyone is.

| Depth | When | Run |
|---|---|---|
| **Self-check** | only prose, comments, or formatting, with no behaviour change, and not a spec or plan | One self-check, reported in a line or two. No panel, no Mode line, no questions. |
| **Single pass** | code where the only lenses that match are Staff engineer, Product, and Frontend & accessibility | One reviewer with the Staff engineer brief, which also works through the checks of the other matching lenses. You triage its findings yourself. |
| **Panel** | any other lens matches, including a project's own lens, or the change is a spec or plan | One reviewer per matching lens, as below. |

When you can't tell whether a lens matches, it matches. A project's `## mob-review` section can move a surface to Panel, such as paths a domain lens owns.

## Pick the mob

Select every lens whose trigger matches the change. Most panels need two or three.

| Lens | Select when the change touches | It checks |
|---|---|---|
| **Staff engineer** | any non-trivial code | correctness, edge cases, architecture boundaries, unnecessary complexity, test quality and coverage of the new behavior |
| **Security** | auth, permissions, user input, secrets, PII, external requests, dependencies, file uploads | authn/authz enforced server-side, default-deny, data exposure, injection, secret handling, dependency risk |
| **Product** | user-facing behavior, workflow, copy, scope | user value, workflow sanity, scope creep, naming and copy clarity, alignment with the agreed spec or issue |
| **Frontend & accessibility** | components, screens, forms, navigation, styling | keyboard operability, semantic elements and roles, focus management, contrast, responsive behavior, loading/error/empty states |
| **Data & contracts** | schema, migrations, API responses, event payloads, persisted shapes | backwards compatibility, migration safety and reversibility, query cost and indexes, retention and deletion |
| **Infrastructure** | IaC, CI/CD, networking, runtime config, deploys | least privilege, blast radius, rollout and rollback path, cost, secret storage, drift from what's committed |
| **Operability** | background jobs, integrations, payments, retries, anything that can fail silently | retry and timeout behavior, idempotency, partial failure; whether on-call can detect it, get enough context to triage, and remediate without reproducing it from scratch |
| **Completeness** | a spec | the problem and who has it; scope and non-goals; behaviour in every state, including errors, empty and offline; acceptance criteria someone could test; open questions answered or listed as decisions |
| **Traceability** | a plan, read against its spec | every spec requirement maps to a task, and every task to a requirement. Where the plan is right and the spec is not, fix the spec: it outlives the plan |
| **Executability** | a plan | each task names the files, the code or command, and the result that shows it worked. Flag steps that leave a choice open ("choose", "TBD", "if needed"), names the plan never defines, and steps that depend on later ones. Read the plan; don't run it |

A spec or plan is never a prose edit: judge the design it describes, not its wording. A spec also gets the lenses for the surfaces it will change. A plan gets Staff engineer when it makes design choices the spec left open.

## Choose models

Run Security, final triage, and any high-risk judgment (payments, migrations, authorization, concurrency) on the strongest model available, even when the user asks for quick or cheap. Cost pressure only moves the other lenses to a mid-tier model, or checklist work with explicit criteria (copy against a spec, markup) to a cheap one. It never removes a lens or weakens a blocker. [model-selection.md](./model-selection.md) says how to set the model in each harness.

## Run them

One subagent per lens is best: each gets independent context, so no lens anchors another. "Available" is a fact, not a judgment: a subagent tool (Agent, Task, spawn_agent, or equivalent) is in your tool list.

| Subagents | Do this |
|---|---|
| Available, and the user or a standing policy sanctioned them | Dispatch one per lens, plus a triage agent if your own model isn't the strongest. |
| Available, not sanctioned | After picking the mob and before any review work, ask: "Mob review runs best as one subagent per lens, so no lens anchors another. Can I use subagents for this review? That's <N> agents: <lenses, plus triage>. Otherwise I run each lens as a separate self-review pass." Then stop and wait. Mentioning the option while carrying on is not asking. |
| Not available, or the user declined | Run a separate pass per lens yourself. Don't ask. |

The scope is the whole change against its base branch: committed, staged, unstaged, and untracked. Each lens brief names its lens and its model, gives that scope and the requirements the change is judged against, and says: change no files, spawn no helpers, return `Status: complete | incomplete`, the findings, and any gaps. It also says: report only what someone should change, each finding naming a failure that can happen and its evidence; a risk the change's code, tests, or docs already handle is not a finding. Keep other lenses' conclusions out of it.

A review changes no project files, index, or refs, your own uncommitted work included. Fixes wait for the user's answer, or for a standing policy that turns on loop mode.

Final triage merges duplicates, checks disputed claims against the code, and keeps each finding's lens. It also drops every finding, at any severity, that the code, tests, or docs already answer. Two lenses raising the same finding is not evidence that it is real.

## Report

In this order:

1. **Mode**, the first line: `Mode: dispatched (<N> subagents)`, `Mode: self-review passes (<reason>)`, or `Mode: mixed (<N> subagents; <M> self-review passes; <why>)`.
2. **Lenses**, one line: the depth and the lens that set it, each selected lens with the clause that triggered it, and the ones you considered and skipped. Say if a lens ran on a weaker model than this skill asks for, or one you couldn't set.
3. **Findings by lens**, numbered in one sequence (`#1`, `#2`, …) so the user can name them back. Tag each `blocker`, `should-fix`, or `optional`, and add `decision` when only a person can settle it: a product choice, a trade-off, a gap in the spec. Give location, what fails, the consequence, and the evidence. Give each `optional` finding one line, after the others. A lens with no findings gets one line. Name any incomplete lens or gap, and any blocker triage dropped, with the reason. Count the other findings triage dropped.
4. **Verdict**: ship, ship after blockers, or needs a decision. An incomplete lens means needs a decision.
5. **How to proceed**, the last line unless loop mode is on:

   > How do you want to proceed? Fix all, fix the blockers only (#1, #4), fix by number, or leave it with you?

   Then stop. The report is the deliverable.

`blocker` means data loss, a security hole, a broken contract, or a user-facing break. Everything else is `should-fix` or `optional`. Only the user can accept a blocker.

## After the answer

Do what the user picked and nothing more. Re-review the fix delta, and the callers and contracts it touches, with every affected lens. Report again in the same shape.

## Standing policy

A team can answer both questions ahead of time in its instructions: `AGENTS.md`, `CLAUDE.md`, the `## mob-review` section of `.agents/project.md`, or a workflow skill it uses. Only a written policy that names mob review counts. Habit, earlier answers in this conversation, and a policy about something else don't. The policy's limits on agents or models still apply. What the user says for this review overrides any policy, and a project's `## mob-review` section overrides a workflow skill's defaults.

**Loop mode** answers the how-to-proceed question with "fix the blockers and should-fixes":

**Budget:** two rounds. Round 1 reviews the whole change. Round 2 checks only the edits, and its findings go in the final report, not into a third round. Skip round 2 when you edited nothing, or when every edit touched only comments, docs, or formatting.

1. End the report with `Loop mode: fixing #… (round 1 of 2)` instead of the question.
2. Fix the blockers and should-fixes. Leave `optional` findings alone. Hold `decision` findings for the end. Fix only inside the files the change already touches. A valid call that works against the code under review must behave the same after the fix, from this repo or not: same arguments, responses, errors, and side effects. A fix that needs anything else is a scope change: don't make it.
3. Run one simplicity pass: delete or narrow code the loop added that the goal doesn't need.
4. Round 2 checks the edits, not the whole change again. Each lens with a fixed finding gets its own reviewer, given the fix delta and the callers it touches. For each of that lens's fixed findings it answers: resolved, not resolved, or the edit introduced a problem (what, with evidence). It reports nothing that was already there before the edits. Security keeps the strongest model; every other lens uses a mid-tier one, payments included, because checking a fix against its finding has explicit criteria.
5. Run `verify` once, after every round-2 reviewer has finished (or round 2 was skipped). With no `verify`, run the tests.
6. Send one final report that ends with this block, copied with its labels and filled in. Nothing follows it.

   ```text
   Status: #1 fixed, #2 fixed, #3 needs a decision, #4 follow-up, …
   Simplicity pass: <what it removed, or "nothing removed">
   Round 2: <one entry per lens reviewer: lens, model, each fixed finding resolved / not resolved / problem introduced; or "skipped: <nothing edited | comments, docs, or formatting only>">
   Verify: <command and result, run once after round 2>
   Decisions:
   1. <question> Options: <a>, <b>. I recommend <a> because <reason>.
   ```

   The first decisions are any blocker still open after round 2, any scope-changing fix you didn't make, and any disagreement triage can't settle. Security or triage on a weaker model, or on one you couldn't set through the model field, is a decision too, and so are a lens that reported itself incomplete and a step 5 run that failed or couldn't run. With none, write `Decisions: none` followed by the policy's next step, or a request to review the change.
