---
name: code-standards
description: Use when writing, reviewing, or refactoring application code — feature work, bug fixes, domain or business logic, or backend changes that reach an API response or persisted data model. Covers SOLID and Sandi Metz sizing rules, ports-and-adapters boundaries, guard clauses, security defaults for authorization, and backwards-compatible wire changes.
---

# Code Standards

Pressure-test evidence: [pressure-tests.md](./pressure-tests.md).

## Priorities

KISS and YAGNI outrank every pattern below. Default to the simplest design that solves the problem in front of you. Add a pattern only once duplication, a second variant, or a real change need proves it's necessary — not because the codebase might need it someday.

## Before adding structure

Run a new abstraction through this filter before writing it:

| Question | If yes | If no |
|---|---|---|
| Does this make a business rule easier to see? | Extract or name it clearly. | Keep it inline, flat, named, and easy to scan. |
| Does this remove real, existing duplication? | Extract the shared concept. | Don't extract for hypothetical reuse. |
| Does this isolate a current external system, persistence boundary, framework boundary, or a variant that already exists? | Introduce a small boundary. | Prefer direct code. |
| Does this lower complexity for the caller and the next maintainer? | Keep the abstraction. | Delete or simplify it. |
| Would adding this violate DRY, YAGNI, or KISS? | Rework the design instead. | Continue. |

## Design rules

| Rule | Apply it as |
|---|---|
| Single Responsibility | one clear reason to change per module, function, or component |
| Open/Closed | when behavior varies by type, provider, plan, or policy, reach for a strategy map or small polymorphic function instead of a growing `if`/`switch` |
| No nested `if` | extract a guard clause, an intention-revealing predicate, or a strategy |
| No nested ternaries | replace with a named variable, an early return, or a small function |
| Branch count (cyclomatic complexity) | reduce it actively, even without nesting — replace a boolean-flag web with a discriminated union, a result object, or a lookup map |
| Sandi Metz sizing | ~100 lines per class/module, ~5 lines per function, ≤4 parameters — treat a violation as design pressure, not an automatic rewrite order |
| Naming | name from the domain, not implementation detail — a vague name that hides a policy decision is a bug waiting to happen |

## Architecture patterns

A pure function is the default starting point for new logic. Reach for the rest only once a specific pressure shows up — don't scaffold them in advance.

- **Use case / application service** — once a feature coordinates authorization, data access, policy, and mapping in one place, name that orchestration as a use case. Thin entry points call it; they don't own the workflow.
- **Port** — define one only when an external dependency (service, datastore, clock, RNG) varies or needs isolating in tests. Implement the adapter at the edge.
- **Composition root** — wire concrete adapters to ports at the entry point, not inside domain logic.
- **Policy object** — once a named business decision (eligibility, entitlement, pricing, access) grows edge cases or gets reused, extract it as a pure, deterministic policy. Table-driven tests suit these well.
- **Wire mapper** — translate an external DTO shape into a domain/UI shape at the boundary; don't let the wire shape spread past that boundary.
- **Tell, Don't Ask** — ask the policy or domain object to make the decision rather than pulling its fields out and re-deriving the rule at the call site.
- **Guard clause** — flatten validation and exceptional paths early; name the predicate when it reveals domain intent.

Dependencies point inward: domain code doesn't import UI, routes, framework adapters, persistence, or generated clients.

## Red flags

Any of these means stop and run the abstraction back through the filter above:

- A new abstraction exists for a future need, not a current, documented one.
- A factory, registry, strategy interface, or plugin shape exists before a real second implementation, or a current testability/boundary need.
- A UI component or hook owns a business decision instead of calling one.
- A generic helper hides domain language that would be clearer at the call site.
- A catch-all file (`utils`, `helpers`, `misc`) keeps growing with unrelated code.
- A module takes a broad object when it only reads one or two fields from it.
- A refactor adds indirection but leaves the code harder to read than before.

## Security defaults

- Authorize on the server. A UI check is an affordance, not a control.
- Default-deny, least-privilege data selection.
- Never trust a client-supplied identity, role, entitlement, ownership, or tenant field.
- Add a test for the unauthorized/forbidden path whenever access rules change.
- Keep secrets out of client bundles, logs, fixtures, error payloads, and CI output.

## Wire and data changes

Before changing anything that reaches an API response, an RPC/query result, a persisted record shape, or an event payload, trace whether the change is backwards compatible. Add fields rather than removing, renaming, narrowing, or repurposing one until every consumer has moved off it — stage a dual-read/dual-write or phased rollout if the change can't be additive. Cleanup is a separate, later change (or a tracked issue), not part of the same commit.

## Review checklist

- Would the simplest version of this design already work, or does a pattern above earn its complexity?
- Is there a failing test for the new behavior before the implementation exists?
- Are domain rules pure and covered by tests, including edge cases?
- Are names intention-revealing, with no vague abbreviation hiding a policy decision?
- If this touches a wire response or persisted shape, is the change additive and backwards compatible?
- Would the next change in this area be obvious to place?
