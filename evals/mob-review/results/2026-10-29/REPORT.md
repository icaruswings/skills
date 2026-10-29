# Mob-review quality pilot, 29 October 2026 UTC

This report follows Simplified Technical English.

**These are provisional machine-graded results. Human adjudication and final approval remain pending. This pilot does not establish equivalent review quality.**

The frozen evaluation used source commit `ffd3ce4bd88fee31c90247f511a9d091657d1f0e` and input hash `0373547496970a1dec96fd3c7a3e37d09495e3db1c97441d2499d503ab83afa4`. It contains 24 unique cases. 18 cases contain 18 known defects, including 17 labeled blockers. The remaining 6 cases are clean controls. Each provider/policy has 3 repetitions, with 288 planned panels in total.

The grader used source commit `345fe0895320441e2d3b81c85492b33a33e36e3e`. The manifest records its source/runtime hash.

There are 16 pilot cases and 8 held-out cases. 14 cases exercise a cheaper model. 10 cases assign every reviewer Strong in both arms. Repetitions produce correlated observations, not additional independent defects.

## Quality results

| Provider | Policy | Completed / planned | Known defects retained | Raw blocker misses / downgrades | Final blocker misses / downgrades | Triage losses | Unmatched final claims | Clean-case alarms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude | all Strong | 72/72 | 54/54 | 0 | 0 | 0 | 8 | 0 |
| codex | all Strong | 72/72 | 54/54 | 0 | 0 | 0 | 0 | 0 |
| codex | tiered | 72/72 | 54/54 | 0 | 0 | 0 | 0 | 0 |
| claude | tiered | 72/72 | 54/54 | 0 | 0 | 0 | 10 | 0 |

Known-defect retention counts semantic matches at final triage. A blocker miss/downgrade means the reviewer or triage omitted a known blocker or assigned it a lower severity. The blocker gate requires detection at the reviewer stage and retention as a blocker at triage. Unmatched claims await human review. They are not automatically false positives. Clean-case alarms count final findings on controls, including optional advice.

- All planned observations complete and model-verified: **pass (provisional)**.
- Every known blocker detected and retained as a blocker: **pass (provisional)**.
- Zero additional missed/downgraded blockers versus the paired all-Strong baseline: **pass (provisional)** (0 pairs with additional misses).
- Unmatched claims resolved: **not passed** (124 raw/final claims queued).
- Human sign-off: **pending**. General quality equivalence: **not established**.

## Cost and time

| Provider | Policy | Calls (failed) | Observed Claude cost | Input tokens (cached subset) | Output tokens | Aggregate process seconds |
| --- | --- | --- | --- | --- | --- | --- |
| claude | all Strong | 222 (0) | $4.3246 | 472615 (237045) | 119725 | 1603.5 |
| codex | all Strong | 222 (0) | not reported | 1677044 (339456) | 23867 | 2407.2 |
| codex | tiered | 222 (0) | not reported | 1640991 (371200) | 25582 | 2193.0 |
| claude | tiered | 222 (0) | $4.1404 | 582726 (304974) | 146176 | 1720.0 |

claude: measured Claude cost savings 4.3%. Aggregate process-time savings -7.3%.
codex: measured Claude cost savings not priced. Aggregate process-time savings 8.9%.

Claude campaign spending is **$9.9316 of the US$20.00 cap**. This includes $1.4666 for discarded/smoke attempts. Unknown Claude cost records: 0. Comparison rows include failed attempts associated with each arm. Arm savings exclude overhead.

Captured Codex CLI usage includes comparison, grading, and overhead. It totals 4014046 input tokens, including 788608 cached tokens, and 74612 output tokens. 10 calls have incomplete usage. Captured totals are lower bounds. These CLI totals exclude authoring/chat/app usage. This report infers no dollar conversion.

Process seconds sum subprocess durations, including startup and retries. They do not measure wall-clock time or estimate user-facing native subagent latency. Calls ran concurrently. Cached input is a subset of input tokens. Output includes provider-reported reasoning where applicable.

## Paired exceptions

No added blocker misses in completed paired observations; see completeness gate above.

## Cases requiring blocker/severity review

No known blocker misses or downgrades in machine matches.

## Evidence and limits

- This report includes [summary and per-observation scores](summary.json), [normalized reviews](reviews.json), and [blinded judgments](judgments.json). It also includes the [human claim queue](human-queue.json), [executable oracle evidence](oracles.json), [manifest](manifest.json), and [normalized call usage](calls.json). These public evidence files reveal the model mapping. Give human adjudicators only the [blinded review packet](blinded-review.json) before they inspect these files.
- `human-review.json` lists truth-label sign-off, severity disputes, triage losses, and unmatched claims. Its pending state is deliberate. Machine matching concealed provider, arm, model, and repetition. It was not a human blind review. The independent grader used Codex Astra/high, which may share model-specific biases with the Codex baseline.
- Fixtures are short, self-contained JavaScript contracts. UI, filesystem, YAML, and provider behaviors are simulations. Five cases adapt two related repository repair commits, so they are not five independent historical incidents. Ground-truth probes and independent code review support the labels. Human label approval remains pending.
- Review roles ran in separate tool-free CLI processes. Strong CLI triage followed. This measures inference on supplied context. Separate tests checked actual Claude/Codex subagent launches. The pilot does not establish full-repository review, architecture discovery, tool use, or native fan-out performance.
- Codex CLI Balanced used `gpt-6-sol/medium`. This CLI/auth context rejected the app-supported `gpt-6.1-sol`. This does not evaluate the app Balanced model. Call records show requested and runtime-resolved models/efforts. Client metadata cannot prove undisclosed backend routing.
- The evaluation froze the candidate, prompts, cases, splits, schemas, and model configuration before the completed matrix. The evaluation did not use held-out answers to tune them. A new run on these cases after a policy change would test for regressions. It would not provide fresh held-out confirmation.
- A separate [live smoke check](final-smoke.json) verified 4 panels and 12 calls after implementation review. It used source commit `a963181885d91f5c08e80414923949685bc3047a`. This smoke check tests orchestration and does not provide fresh held-out quality confirmation.
- Keep the PR draft until humans adjudicate claims and severity labels, review blocker exceptions, and approve acceptance. Promote bounded tasks that miss real blockers. Then evaluate the changed policy on new held-out cases. Do not infer general parity from an aggregate score.

## Split and role detail

`summary.json` contains detailed per-split summaries, per-lens attribution, paired deltas, and per-role resource totals. A lens can discover a defect labeled for another lens. Per-lens detections therefore do not share a common recall denominator.
