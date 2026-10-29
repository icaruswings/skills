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

## Round 6 — report, then ask; never fix inside the review

Field report: agents running this skill tended to fix what they found instead of reporting it. The cause was in the text. The done-condition read "blockers are fixed or explicitly accepted", and the blocker rule offered the same two exits. Of those, fixing is the one the agent controls, so it took that exit. Nothing said the report was the deliverable.

Changes: a standing rule that a review changes no files, with the first edit waiting on the user's answer; findings numbered in one sequence across the report so the user can name them back; a fifth report item, a how-to-proceed question with the choices spelled out (fix all, blockers only by number, fix by number, or leave it); a new "After the answer" section that owns the re-review rule; and a done-condition that names the question and "no file has changed" as the finish.

Verified on the checkout handler in a real git fixture with an editable file and a user who declined subagents and wanted to push "in the next few minutes", two arms, file hash checked before and after:

- **RED (old wording)**: did not edit the file. It reported, then closed on an open offer: "Tell me which DB driver `db.query` wraps and I can apply the parameterised query". Findings were unnumbered, so the user had no way to pick. Under Claude the fixing tendency did not show in this run; the gap it shows is the unstructured close, which is the same wiggle room Round 5 found on the subagent ask.
- **GREEN (new wording)**: did not edit the file. Fifteen numbered findings across four lenses, a verdict, and the turn ended on "How do you want to proceed? Fix all, fix the blockers only (#1, #7), fix by number, or leave it with you?"

## Round 7 — provider-aware model tiers (2026-10-29)

The previous skill had no model/effort routing, escalation, or unavailable-model policy. Added Economy, Balanced, and Strong task tiers, provider-native model controls, explicit final-triage routing, and visible fallback/verification gaps. The seven lens definitions and existing blocker, read-only, re-review, and prose-only rules are unchanged.

### RED / GREEN micro-tests

Used `superpowers:writing-skills`: five fresh-context samples per variant, manually read, with the same auth/ownership/race-condition scenario, a Balanced parent, and pressure to use the cheapest adequate approach and finish quickly. Samples proposed launch arguments without performing a real review. No expected answers were supplied.

- **RED, old skill: 5/5 missed the new quality requirement.** All chose `gpt-6-luna` for Security and left final synthesis with the parent. Four used low effort, one omitted effort. One rationalized: “The low-cost Luna model at low effort fits the bounded lens and deadline.” This was missing policy, not a violation of the old skill.
- **GREEN, updated skill: 5/5 selected `gpt-6-astra`, high effort, and a clean context for Security, plus a separate Astra final-triage agent.** No model/tier variance. One response named the triage model without repeating effort/fork settings; this was a proposed-call test, not a completed launch.
- Eight additional scenarios covered bounded form checks, payments/migrations, reviewer disagreement, absent model controls, Claude managed substitution, unsanctioned subagents, prose-only edits, and partial dispatch failure. Independent validation found understated triage consent counts and ambiguous cost constraints; both were corrected and rechecked.

### Live launches

These are actual dispatch tests with synthetic inline fixtures, not inferred model choices. Reviewers could not edit files. Effective models below were checked from Codex `turn_context` records and Claude forwarded assistant-message metadata, not agent self-reports.

| Runtime | Task | Requested model | Confirmed model |
|---|---|---|---|
| Codex | Economy copy evidence | `gpt-6-luna`, medium effort | `gpt-6-luna`, medium effort |
| Codex | Balanced routine correctness | `gpt-6.1-sol`, medium effort | `gpt-6.1-sol`, medium effort |
| Codex | Strong ownership-authorization review | `gpt-6-astra`, high effort | `gpt-6-astra`, high effort |
| Claude Code | Economy copy evidence | `haiku` | `claude-haiku-5-5` |
| Claude Code | Balanced routine correctness | `sonnet` | `claude-sonnet-5-5` |
| Claude Code | Strong ownership-authorization review | `opus` | `claude-opus-5-5` |
| Claude Code | Final triage from a Sonnet parent | `opus` | `claude-opus-5-5` |

All seven launches completed. Both Security reviewers caught the planted missing owner check as a blocker. Claude autonomously chose the three aliases from the updated skill, then delegated triage to Opus rather than doing it on Sonnet. Its four-agent run reported US$0.1564196; that single-run cost does not establish comparative savings. Codex smoke tests exercised explicit native launch parameters; the paired micro-tests separately checked automatic model-selection decisions.

Limitations: provider rejection/substitution and missing-control cases were scenario tests, not forced live outages. Model aliases/catalogs may change; rerun live checks after changing mappings. Some reviewers could not observe their own effective model, so they correctly reported unknown; the external runtime traces supplied confirmation for these tests.

### Repeatable checks

1. Run five fresh-context controls with the old policy and five with the updated policy. Keep the scenario and runtime catalog identical; record every choice and read the responses.
2. Launch the copy, local-correctness, and ownership fixtures using the active harness's actual model fields. In Claude, a Balanced parent must also delegate Strong triage. Do not preselect models in the test prompt when testing autonomous routing.
3. Compare requested models with runtime metadata. Treat self-reports and accepted launch arguments alone as insufficient evidence of the effective model. Keep permissions read-only and any account/model constraints intact.
4. Parse the YAML/TOML examples, check local reference links, and run `node scripts/check-skills.mjs` plus `git diff --check`. Both linked skill paths should resolve to this same source.

## Form note

The baseline failure here is wrong-shaped output plus omitted elements, not a discipline violation — so per `writing-skills`' "Match the Form to the Failure", this skill uses a positive output contract and a structural "name the lenses you selected" slot rather than a prohibition list. The proportionality rule is a conditional on an observable predicate (prose/comments/formatting only, no behavior change), not an exemption clause.

## Round 8: matched quality pilot (2026-10-29)

The [versioned benchmark](../../evals/mob-review/README.md) compares tiered reviewers with all-Strong reviewers, followed by Strong triage.
It contains 24 cases: 18 known defects and six clean controls. A fixed split assigns 16 cases to pilot and eight to holdout.
Each provider/policy has three repetitions. All 288 panels and 888 reviewer/triage calls completed with verified runtime models.

A separate Codex Astra/high grader matched findings without provider, model, policy, or repetition labels.
Each provider/policy retained 54/54 known-defect observations, with no known blocker misses, severity downgrades, or triage losses.
The clean controls had no final findings. Additional findings remain pending human adjudication; they are not automatically false positives.

Measured Claude comparison cost was US$4.1404 for tiered reviewers and US$4.3246 for all Strong, a 4.3% reduction.
Tiered Claude calls took 7.3% more aggregate process time. Codex aggregate process time fell 8.9%; its dollar cost was unavailable.
These observations do not establish a cost or latency guarantee.

The [report and normalized evidence](../../evals/mob-review/results/2026-10-29/REPORT.md) separate unique cases from repeated observations.
They also distinguish CLI quality testing from Round 7's native subagent launch checks.
Codex CLI Balanced used its supported `gpt-6-sol`; the app launch test used `gpt-6.1-sol`.
Ten cases use Strong in both policies, and fixtures simulate short contracts rather than complete applications.

The evaluation kept model mappings, prompts, cases, and holdout assignment fixed.
Independent implementation review found harness lifecycle and accounting edge cases after the matrix source freeze.
Offline regression tests verify those repairs, and the report identifies the exact earlier evaluation and grading commits.
Human approval remains pending. This pilot supports its stated cases and cannot establish general review-quality equivalence.
