# Mob-review evaluation

This guide follows Simplified Technical English.

This harness compares tiered reviewers with all-Strong reviewers on the same fixed cases. Both schemes use Strong final triage.
Each reviewer is an independent, tool-free CLI call with one assigned lens. The harness keeps reviewer findings and final triage separately.
Native app subagent fanout needs a separate smoke test. These CLI results do not establish native launch behavior.

## Check the harness and cases

Run commands from the repository root with Node.js 24 or later available:

```sh
node --test evals/mob-review/tests/*.test.mjs
node --input-type=module -e "import { verifyCorpus } from './evals/mob-review/corpus.mjs'; console.log(JSON.stringify(verifyCorpus(), null, 2));"
```

These checks do not launch models. The corpus has 24 cases, including six clean controls, with 16 pilot cases and eight holdout cases.
Executable oracles run the supplied source against explicit contracts. They establish fixture behavior, not reviewer quality.
Historical adaptations include commit provenance, but the small fixtures do not reproduce complete applications.

## Confirm models and spending authority

Check the CLI that will launch reviewers:

```sh
claude --version
codex --version
codex debug models --bundled
```

The runner validates its configured Codex model IDs and reasoning efforts against that CLI catalog.
Its mapping is Economy `gpt-6-luna` at medium, Balanced `gpt-6-sol` at medium, and Strong `gpt-6-astra` at high.
Claude uses `haiku`, `sonnet`, and `opus`. Every completed call must confirm its effective model and any requested reasoning effort.

The app and CLI can expose different models. App support for `gpt-6.1-sol` does not make it a supported CLI replacement.
See [model selection](../../skills/mob-review/model-selection.md) for the client-specific rules.

Claude requires an explicit, authorized dollar cap through `--claude-cap`. Use the approved cap; the option does not grant spending authority.
The shared `--budget-root` includes every run, replacement run, smoke, and failed attempt beneath it.
Keep that root when restarting. A fresh run directory does not reset spending.

The runner reserves $0.20 per Claude call and holds one root-level budget lock across the run.
Codex calls can consume account usage even when their dollar cost is unknown.
The 2026-10-29 run has an approved US$20 Claude cap, including smoke, failed, and aborted calls. Codex token usage is separate.

## Run and resume

Set `APPROVED_CAP_USD` to the amount the user explicitly approved before running this example:

```sh
node evals/mob-review/run.mjs \
  --dir .eval-work/2026-10-29-cli \
  --budget-root .eval-work \
  --providers claude,codex \
  --repetitions 3 --jobs 4 \
  --claude-cap "$APPROVED_CAP_USD"
```

Use `--split pilot`, `--split holdout`, or `--cases C01,C02` to select a smaller matrix in a new run directory.
The full matrix has 288 panels across two providers, two schemes, 24 cases, and three repetitions.
The runner processes pilot cases before holdout cases. Repetitions remain repeated measurements of the same cases, not independent samples.

To stop scheduling panels, create `STOP` inside the run directory or interrupt the runner. Calls already underway can finish.
Remove `STOP` before resuming with the same options. The runner reuses complete calls and panels when their identities match.
Changed execution inputs or matrix require a new run directory under the same budget root.
Do not edit frozen execution files during a live run.

Unknown Claude spend blocks further spending. Reconcile the saved call records against actual usage before continuing or retrying.
The `--retry-known-failures` option permits one retry key for a failed call with unchanged inputs.
It preserves the original attempt and requires known Claude spend. Inspect a budget lock's owner before removing a stale lock.

The run directory contains the manifest, per-call records, saved prompts and outputs, per-panel results, progress, and the final `reviews.json`.
The manifest records input hashes, CLI versions, environment hashes, model configuration, and the validated Codex catalog.

## Grade and report

The grader launches Strong Codex calls. Run it after the review run, or add `--watch` to grade cases as their panels finish:

```sh
node evals/mob-review/grade.mjs --dir .eval-work/2026-10-29-cli --jobs 2
```

The grader receives opaque panel IDs without provider, model, scheme, or repetition labels.
It provisionally matches raw and final findings to expected defects. Grading records stay under the run's `grading/` directory.
Incomplete panels cannot become complete evidence through grading.
Watch mode waits for complete, verified panels, even when an earlier interrupted run left partial results.
For permanent errors, interrupt the watcher and grade without `--watch` to report the partial evidence.
Runner and grader interruptions stop new work and drain active calls before releasing ownership.

Generate the report after the run and grading finish. Set `EVALUATED_SOURCE_COMMIT` to the exact commit that supplied the evaluated execution inputs:
Set `GRADING_SOURCE_COMMIT` to the exact commit that supplied the grader code. Commit both versions before their live runs.

```sh
node evals/mob-review/report.mjs \
  --dir .eval-work/2026-10-29-cli \
  --budget-root .eval-work \
  --out OUTPUT \
  --source-commit "$EVALUATED_SOURCE_COMMIT" \
  --grading-source-commit "$GRADING_SOURCE_COMMIT"
```

Report sections cover matrix completeness, resources, provisional defect matches, paired comparisons, and a blinded human queue.
The CLI checks the supplied commit against the frozen manifest and current evidence sources before writing output.
Use a separate output directory from the raw run data.
The 2026-10-29 run evaluated commit `ffd3ce4` and used grader commit `345fe08`. Future runs need their own exact source commits.

Missing comparison arms must remain explicitly incomplete. Resource totals include failed attempts and distinguish known amounts from unknown usage or cost.
Observed totals with missing measurements are lower bounds. Summed process time does not measure elapsed run time when jobs overlap.

Human adjudication remains pending. An unmatched claim may identify a real defect beyond the oracle; it is not automatically a false positive.
Machine matches, zero added missed blockers, and a passing machine gate do not establish human approval or quality parity.
Read the [completed pilot report](results/2026-10-29/REPORT.md) for actual results and limits.
Separate [native launch evidence](native-launch-validation.json) records the Claude and Codex app subagent checks.
