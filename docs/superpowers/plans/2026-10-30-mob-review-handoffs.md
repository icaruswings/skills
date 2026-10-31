# Compact mob-review handoffs implementation plan

> **For agentic workers:** Use the writing-skills workflow to execute this plan inline, with fresh-context pressure tests.

**Goal:** Reduce repeated context while keeping review findings supported and attributable.

**Architecture:** Keep policy and reporting in SKILL.md. Put the operational handoff contract in a sibling reference. Record behavioral evidence in pressure-tests.md.

**Spec:** `docs/superpowers/specs/2026-10-30-mob-review-handoffs-design.md`

## Constraints

- Preserve lenses, tiers, consent, severity, and the report-first fix boundary.
- Preserve the model-tier PR and frozen evaluation artifacts.
- Keep every reference beside SKILL.md and reachable from it.
- Report behavioral evidence separately from measured token or quality claims.

## Task 1: Establish baseline behavior

- [x] Preserve the original instructions outside the checkout.
- [x] Run five fresh-context control samples and a broader interruption/fix scenario.
- [x] Read every result and identify omissions the new contract must address.

## Task 2: Update the skill

- [x] Add `skills/mob-review/review-handoff.md` with package, reviewer, triage, and resumption contracts.
- [x] Update `skills/mob-review/SKILL.md` to reach the contract after consent, disclose gaps, and permit only temporary evidence artifacts.
- [x] Repeat the same five samples with the updated instructions; inspect regressions and variance.
- [x] Exercise a concrete fixture and record outcomes in `skills/mob-review/pressure-tests.md`.

## Task 3: Verify delivery

- [x] Review the final instructions independently for quality regressions and contradictions.
- [x] Run `node scripts/check-skills.mjs`, the existing evaluation tests, prose checks, and `git diff --check`.
- [x] Confirm installed symlinks resolve to the edited skill without replacing unrelated skills.
- [x] Report files changed, checks, and limits. Make no token-saving or quality-equivalence claim without measurements.
