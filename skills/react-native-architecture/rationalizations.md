# react-native-architecture: Common rationalizations

Reference detail for the `react-native-architecture` skill. Read this when:

- About to place new code and feeling uncertain.
- Reviewing a PR and trying to articulate why something feels wrong.
- Your reasoning matches "everyone else does it that way" — the excuses below are real failure modes, not hypotheticals.

For the layer rules and decision table, see `SKILL.md` in this skill.

## Common rationalizations

Recognise and reject:

| Excuse | Why it's wrong |
|---|---|
| "I'll put the rule in `components/utils/` because that's where similar code lives" | Existing co-location is the bug being fixed. Domain rules go in `domain/`. |
| "It's a parser, so it belongs next to the API types" | Parsing wire format → typed shape is `data/`. **Interpreting** parsed data (e.g. "no permission field means denied") is a business rule and goes in `domain/`. |
| "I'll use `string`/`number` for the ID because the rest of the codebase does" | Branded types prevent ID-swap bugs. Primitive obsession is exactly what's being fixed. |
| "The screen lives in `components/` to match existing patterns" | Screens go in `features/<x>/ui/`. The route file in `app/` is the entry point. |
| "Validation is presentation, so it stays in the screen" | Form-shape validation, yes (required fields, length). **Business validation** ("at least one contact method must be enabled") is domain. |
| "Minimal diff — leave the conditional in the hook" | A hook with a business conditional is the smell being eliminated. Move it. |
| "The Home screen needs another feature's CTA, I'll import it from its internal `ui/components/...`" | Cross-feature imports use `features/<x>/ui/public/...` only. If the component isn't under `public/`, the owning feature decides whether to promote it — not the consumer. |
| "I'll add an `index.ts` barrel to make imports nicer" | No barrels inside `features/`. Direct imports from `ui/public/` are the public surface. Barrels hurt Metro tree-shaking and encourage import sprawl. |
| "This tab needs its own feature folder" | Tabs are routes, not features. Make a feature only when there's a product capability behind it. A Home tab usually maps to a `home/` host feature whose job is composition, not to a "home capability". |
| "The reducer touches `log.info` already, I'll keep it that way" | Reducers in `domain/` are pure. Move side effects into the hook that dispatches the event — domain returns the new state and an event description; the hook fires the side effect. |
| "This exception is thrown from feature A and caught in feature B — I'll put it wherever's convenient" | Exception classes thrown across feature boundaries live in `shared/domain/`. Putting one in either feature inverts the dependency. |
| "This auth-token helper belongs in `features/auth/data/` because it's auth-related" | Anything consumed by `shared/data/` (the base API client, cache config) cannot live inside a feature — that inverts the dependency. Cross-cutting infrastructure goes in `platform/`, even when it's conceptually tied to one feature. |
| "The codebase already does it this way for a similar case, so matching it is less disruptive than introducing a new pattern" | An existing violation is debt, not precedent. Copying it doubles the violation instead of halving the work — the compliant placement costs the same one file whether or not something nearby already got it wrong. Fix new code to the rule; flag the existing instance as a followup, don't extend it. |
