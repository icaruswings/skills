# Review handoff

## Coordinator: package once

Identify the agreed base and exact review scope before dispatch. For working-tree reviews, include scoped committed, staged, unstaged, and untracked changes. Resolve an ambiguous base before claiming complete coverage.

Prepare one package containing:

- Review identity: base/head commits, scoped file manifest, and a digest of the reviewed diff and untracked contents.
- Relevant requirements, repository instructions, and decisions needed to judge this change.
- Diff with surrounding context and scoped untracked contents.
- Existing test evidence: commands, results, code identity, and behavior covered. Mark evidence with an uncertain code identity as unverified.

Keep artifacts outside the checkout. Share paths when reviewers can read them; otherwise supply the same material inline. Record unavailable material as a gap. Check that package inputs still match the checkout before triage. Changed inputs require an updated package and review of the affected scope.

Dispatch in a fresh context, using the runtime's supported isolation controls. The brief contains the assigned lens/tier, package reference, relevant context, and result contract below. Keep session history and other lenses' conclusions out of independent passes. Preserve all selected lenses; the coordinator owns dispatch and follow-ups. Reviewers do their assigned work without spawning helpers.

Carry these restrictions in every brief: change no project files, index, or refs; spawn no helpers. Return results inline or write only the designated temporary report outside the checkout. Use inline results when temporary storage is unavailable.

## Reviewer: return evidence

Read the package once. Read more code when a finding or coverage question needs it, including callers, shared contracts, and dependencies. Name the risk and what you checked. A short diff does not bound the investigation.

Record paths, repositories, and content digests or immutable revisions for additional material your conclusions rely on. Include these identities in Checks.

Assess existing test evidence against the code and behavior it covers. Reuse matching results. Run focused checks for unanswered doubts or stale evidence. Run broader validation when a named risk needs it. A passing test does not establish that its assertions cover the requirement.

Return this compact result, with no finding-count limit:

```text
Lens / review identity:
Status: complete | incomplete
Checks: areas inspected; test commands/results performed or reused
Findings: blocker | should-fix | optional; location; failure condition;
          consequence; supporting evidence
Gaps: unresolved checks, assumptions, or missing evidence; none if complete
```

Use `complete` only when you have covered the assigned scope and no verification gap remains. State `no findings` explicitly. Keep explanation proportional to the evidence needed to judge each finding. If a detailed temporary report is useful, return its path with status, findings, and gaps; triage must read the evidence.

## Triage: reconcile once

Use Strong triage as required by SKILL.md. Recheck the identities of additional material before triage; review conclusions affected by any mismatch. Read every lens result against the package. Check supporting code or tests for disputed claims. Preserve lens attribution and every unresolved gap.

For each proposed blocker, record retained, merged into another finding, downgraded, or unsupported, with the evidence-based reason. Include dropped or downgraded blocker dispositions in the user report.

Resolve factual misunderstandings directly. Follow the existing Strong escalation rule for unresolved correctness or risk disagreements. An incomplete pass cannot become a clean result through synthesis.

## Resume and re-review

Keep a compact record of review identity, lens scope, agent identity, confirmed model, status, and result location. After interruption, reuse completed results only after checking their inputs and relevant dependencies still match. Resume the unfinished reviewer with the specific question and new evidence. If it is unavailable, give its replacement the original brief, result, and unresolved question.

After authorized fixes, package the fix delta, original findings, and updated test evidence. Re-review each affected lens for resolution and new breakage. Expand coverage when shared contracts or dependencies change. Carry forward unaffected results only after checking that their assumptions still hold; identify their original scope. Reconcile the updated results once at Strong before reporting.
