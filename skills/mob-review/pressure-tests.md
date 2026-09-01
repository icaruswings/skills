# Pressure tests

Scenarios used to check whether this skill changes agent behavior, run as paired subagents — one with no skill (RED), one instructed to invoke `mob-review` first (GREEN). Three surfaces, chosen so lens *selection* is observable: an IaC change, a UI component, and a docs typo. Rerun when the skill is materially edited.

## RED baselines

All three ran a single undifferentiated review pass. Failures:

- **No lens separation.** Findings were reported in discovery order, so severity tracked what the agent noticed first rather than what was riskiest. In the checkout-dialog scenario, "the server must recompute the total, never trust a client-supplied amount" — the one finding that lets a user pay an arbitrary price — landed at **#17 of 19**, filed under "Design", below Tailwind layout observations.
- **Whole perspectives missing.** Neither the IaC nor the UI review raised operability (dead-letter queue, log retention, timeout/memory defaults), rollout/blast radius, or cost. A generic "senior engineer" pass is broad but has no forcing function for these; a named lens does.
- **No proportionality.** The one-word README typo drew 4 tool calls and ~400 words of investigation.

## GREEN

- **IaC**: selected Infrastructure, Security, Operability, Staff engineer; explicitly named Data & contracts and Product/Frontend as considered-and-skipped. The Operability lens produced the missing DLQ, the never-expiring auto-created log group, and the 3s/128MB defaults — none of which RED found. Security also connected two findings RED had reported separately into a privilege-escalation chain (wildcard `s3:*` reaches the Terraform state bucket, which holds the plaintext password).
- **UI**: selected Staff engineer, Frontend & accessibility, Product, Security. The client-derived charge amount was promoted to a `blocker` under Security. The Product lens caught currency ambiguity on the Pay button (country selector, bare `$`), which RED missed entirely.
- **Docs typo**: took the scaling rule, produced a few lines and a `ship` verdict.

Conclusion: lens selection varied correctly by surface, and the output contract (lenses selected → findings grouped by lens → verdict) fixed the ranking failure that made RED's most severe finding hard to find.

## Round 2 — do analytics and performance need their own lenses?

Hypothesis: the roster was missing a measurement lens and a performance lens. Tested with a product-feed component carrying planted analytics faults (an event renamed off `product_click`, mixed naming conventions, PII in the payload, a redundant client timestamp) and performance faults (a 2N+1 waterfall with the per-item calls serialised, unbounded list, no lazy loading).

**The hypothesis was wrong — neither lens is needed.**

- Analytics routed correctly without one. `Data & contracts` (whose trigger already names event payloads) caught the rename as a silent-zero `blocker`, the property-shape changes, and email as the wrong join key. `Product` caught the schema being unable to answer the questions it exists for, the mixed conventions, and the redundant `ts`. Two lenses hitting it from different angles beat one dedicated lens.
- Performance routed correctly too. `Staff engineer` caught the 2N+1 including the subtle part — the two awaits inside the object literal are sequential per item — and `Frontend & accessibility` caught layout shift and lazy loading.
- Only list virtualization and consent-gating-before-tracking were missed by every arm. Too thin to justify two lenses against a skill whose core rule is "most changes need two or three".

## Round 3 — sharpening Operability

Round 1's UI run misfiled the missing payment idempotency key under `Security`, and Operability's trigger ("background jobs, integrations, anything with a failure mode") didn't obviously reach a payment handler. Widened it to name payments, retries, and silent failure, and gave it retry/timeout behavior, idempotency, and partial failure explicitly.

- On a server-side checkout handler, Operability is now selected and owns the idempotency key as a `blocker`, alongside charge-before-persist ordering, the inline confirmation email on the request path, and missing charge/order correlation for on-call.
- On the client-side feed from Round 2, Operability is still correctly *skipped* ("no jobs/retries/payments; the silent-failure concerns land in Staff engineer") — the widened trigger didn't cause over-selection.

## Round 4 — asking before dispatching subagents

The dispatch rule was a flat "use subagents when available", which leaves two bad outcomes: spawning a fleet the user never asked for, or quietly self-reviewing while the report still reads as though a mob ran. Replaced with a three-row table keyed on whether subagents are available *and sanctioned*, with an explicit ask in the middle row.

Verified on the checkout handler with an agent that had subagent tooling available but no instruction to use it. It opened by stating it wouldn't dispatch unasked, said plainly that it was running each lens as a separate self-review pass instead, and told the user how to get the dispatched version — then produced the full four-lens report. No silent downgrade, no unrequested fleet.

## Round 5 — a blocking ask, a mechanical availability test, and a Mode line

Field failure (Codex, 2026-09-01): the skill ran as straight self-review passes — no ask, no statement of which mode ran. Round 4's own GREEN record shows the seed of it: the "ask first, wait for the answer" row was satisfied by *mentioning* the dispatched alternative while proceeding, and that run was logged as a pass. Two gaps: "available" was a judgment call a harness without a Task tool resolves silently, and nothing in the report structure forced disclosure of which mode ran.

Changes: "available" is now defined mechanically (a subagent tool exposed in the session — check the tool list); the ask is a verbatim blocking question ("Can I use subagents for this review? That's <N> agents: <lenses>…") with "mentioning the option while proceeding is not asking" stated outright; the no-tool row says don't ask; and the report contract gains a required first line, `Mode: dispatched (…)` or `Mode: self-review passes (<reason>)`, so a quiet downgrade can't produce a well-formed report.

Verified on the checkout handler (SQL-injection bait, response-shape change), four arms:

- **RED (old wording, tool exposed, unsanctioned)**: asked and waited in this run — the old wording can behave under Claude; the failure is the wiggle room Codex (and Round 4's own record) fell into, not a universal miss.
- **GREEN, tool exposed, unsanctioned**: picked the mob, ended the turn on the blocking question with agent count and lens names, no findings leaked before the answer.
- **GREEN, user declined**: led with `Mode: self-review passes (user declined subagents)`, ran explicit per-lens passes, caught the injection as a `blocker`.
- **GREEN, no subagent tool exposed**: did not ask, led with `Mode: self-review passes (no subagent tool exposed)`, full four-lens report, and flagged what it couldn't verify.

## Form note

The baseline failure here is wrong-shaped output plus omitted elements, not a discipline violation — so per `writing-skills`' "Match the Form to the Failure", this skill uses a positive output contract and a structural "name the lenses you selected" slot rather than a prohibition list. The proportionality rule is a conditional on an observable predicate (prose/comments/formatting only, no behavior change), not an exemption clause.
