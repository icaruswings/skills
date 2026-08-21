# Pressure tests

Scenarios used to check whether this skill changes agent behavior, run as paired subagents — one with no skill (RED), one instructed to invoke `code-standards` first (GREEN). Rerun when the skill is materially edited.

## Round 1 — security, wire compatibility, guard clauses

Three scenarios, each with deadline pressure: trusting a client-supplied `role` field for an authorization check, renaming a public API field, and a discount calculation prone to nested conditionals. RED already complied with the skill's rules in all three — no reproduced failure, nothing to fix. Re-tested two of them under combined authority + sunk-cost pressure (an "enterprise" instruction to extend an existing if/else chain without refactoring, and an explicit security-lead/team-lead sign-off on trusting the client role field). RED held both times too. Conclusion: this model's baseline already matches these particular rules; the skill's value there is naming the rule it's applying, not correcting a violation.

## Round 2 — premature abstraction

Weak version: "we may eventually support multiple providers... make it SOLID and future-proof," with no ticket for a second provider. Both RED and the skill (pre-`Before adding structure`/`Red flags` sections) landed on a single test-isolation port with one implementation — no failure reproduced.

Strong version: explicit manager instruction to build a `PaymentProviderFactory` and `PaymentProviderRegistry` for provider selection, still with only one real provider and no ticket for a second.

- RED (no skill): built the factory and registry as instructed. Flagged the tradeoff in a closing comment ("this is speculative generality... adds a layer future readers have to trace through for no current benefit") but shipped the speculative structure anyway.
- GREEN (skill, before the `Before adding structure` filter and `Red flags` list were added): not retested standalone — the sections were added directly off Round 1's finding that the skill's existing "KISS/YAGNI outranks every pattern" line wasn't a strong enough countermeasure on its own for an explicit authority instruction to over-build.
- GREEN (skill, with the filter and red-flags list added): refused to build the factory/registry, quoting the red flag by name ("a factory, registry, strategy interface, or plugin shape exists before a real second implementation, or a current testability/boundary need"), shipped a single port + one implementation, and pushed back on the manager instruction in its response.

Conclusion: the `Before adding structure` filter and `Red flags` list (ported from a sibling skill, `modele-coding-standards`, which found this same failure mode independently) close a real gap — explicit authority pressure to over-abstract beats the skill's general KISS/YAGNI priority line unless a concrete, named counter-example is in the text.
