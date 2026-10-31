# Mob-review quality evaluation

The user approved a matched quality benchmark and a new PR, following the agreed approach: representative known defects and clean changes, tiered versus all-Strong reviews, repeated runs on Claude and Codex, blind adjudication, held-out cases, and explicit acceptance criteria. This document records that scope; it does not assert quality parity.

## Approach and boundaries

Use a dependency-free Node evaluation harness in `evals/mob-review/`, with 24 self-contained diffs: 16 pilot cases and 8 held-out confirmation cases. Include seeded defects, clean changes, and minimal adaptations of historical regressions from this repository. No private application source or credentials belong in prompts or committed artifacts. Historical adaptations identify the source commit and explain their reduced scope.

Each case has independently executable before/after checks, a review brief, selected lenses and policy tiers, and hidden expected findings. Only the brief, lens, and review contract enter the review prompt. Cases use neutral IDs. Verify each planted defect fails after the change and passes before; clean changes pass both. Review the fixture and oracle before live evaluation.

Compare identical role prompts, inputs, context, permissions, and output schemas. The only intended variable is model mapping: tiered Economy/Balanced/Strong versus all Strong. Each lens runs in a fresh CLI process; Strong triage receives the reports and original brief. This isolates inference quality with independent role contexts; native subagent routing has separate live-launch evidence already. Record this boundary rather than calling CLI roles a native subagent panel.

Run three repetitions per provider/configuration/case, with resumable execution and explicit budget enforcement. The user selected a US$20 Claude pilot cap; count smoke tests and failed calls within it. Codex token usage is recorded separately; no fabricated dollar conversion. Record requested and observable effective models, failures, elapsed time, and incomplete runs. Never silently substitute a cheaper model. Reviewers have no editing or tool access; any tool use contaminates the sample.

Freeze a stratified holdout before live runs: C02, C03, C06, C13, C15, C20, C21, C24. The other 16 cases are pilot cases. Both splits cover all seven lenses and Economy tasks; holdout has two clean controls and pilot has four. C12's open migration uses Strong for both reviewers.

Hide provider/configuration mapping behind opaque run IDs during scoring. Executable checks establish planted defects; independent model-assisted matching of findings is provisional, with human adjudication required for disputed/new findings and final approval. Do not describe machine scoring as human review.

## Gates fixed before live runs

- Every known blocker must be detected and retained through final triage in every completed repetition; report any miss by case, role, provider, and configuration.
- Tiering must add zero missed known blockers compared with all Strong. Report paired differences rather than concealing them in an aggregate score.
- Report known-defect recall, incorrect severity, unmatched findings pending human adjudication, clean-case alarms, triage losses, cost, time, and model-verification gaps, by provider and role.
- An incomplete run, unverified substitution, unadjudicated finding, or absent human sign-off prevents a quality-equivalence claim.
- Pilot results may justify promoting a role/task to a stronger model. Freeze changes before held-out confirmation; do not tune on held-out answers.
- A 24-case corpus is a pilot and does not prove general equivalence or independence of repeated observations. Report unique-case coverage separately from repetitions.

## Alternatives considered

Routing smoke tests are already useful but cannot measure missed bugs. An external hosted eval service would add account dependencies and offers no needed capability here. A local, versioned harness makes the cases, runs, grading, and limitations inspectable in the PR.

## Deliverables

The PR includes the existing cross-provider tiering update, reproducible corpus/oracles, tested runner and scorer, raw-output handling and redaction rules, a report with real results and limitations, and any narrowly justified policy correction. Open the PR as draft while human adjudication or quality gates remain unresolved. Do not modify the Box'd working tree.
