---
name: react-native-architecture
description: Use when adding new code, refactoring modules, or deciding which layer owns a function/hook/component in a feature-first layered React Native app (app/features/shared/platform structure). Triggers on files landing in features/, shared/, platform/, app/, components/, hooks/, or services/, and on questions about branded types, layer boundaries, screen vs route, public vs private feature surface, or "where does this go".
---

# React Native Architecture

Feature-first layered architecture with enforced boundaries, for React Native apps that want isolated features and pure, testable business logic.

## Layer model

```
src/
  app/        # thin route entries (file-based routing) — no logic
  features/<x>/
    domain/   # Pure business rules + pure reducers — no React, no state library, no SDKs
    data/     # API calls, mappers, mutation/query hooks — returns domain types
    ui/
      public/ # Cross-feature consumable components (the feature's public surface)
      ...     # Internal screens, components, hooks (private to the feature)
  shared/
    domain/   # Cross-feature domain models, branded IDs, cross-cutting exception classes
    ui/       # design-system, layouts, primitives
    data/     # Base API client, cache config
  platform/   # Logging, analytics, formatters, device, env, i18n, storage, auth tokens
              # — vendor/framework SDKs are ALLOWED here; purity is for domain/ only
  state/      # Global app-level state that spans features (e.g. offline queue, session)
```

**No barrel `index.ts` files inside `features/`.** Cross-feature consumption is via direct imports of files under `features/<x>/ui/public/`, not re-exports. Metro tree-shakes barrels poorly, and barrels encourage import sprawl.

## Enforce it, don't just document it

A rule that lives only in this file survives code review but not a deadline — under combined time pressure and "the codebase already does it this way," even careful reasoning can talk itself into the wrong placement. Wire the layer boundaries into a lint tool so a violation fails the build instead.

Before writing new code in a project that doesn't have this wired up yet, run [`scripts/check-dependency-cruiser.sh`](./scripts/check-dependency-cruiser.sh) (in this skill) from the project root:

| Script reports | Do this |
|---|---|
| `package: installed` and `config: present` | Nothing to do — enforcement is already wired up. |
| `package: missing` or `declared-not-installed` | Ask the user whether to install `dependency-cruiser` as a dev dependency. If yes, install it, then scaffold `.dependency-cruiser.cjs` from [dependency-cruiser.template.cjs](./dependency-cruiser.template.cjs) in this skill, adjusted to the project's actual directory names. |
| `config: missing` (package already installed) | Ask before scaffolding the config — don't overwrite silently in case one already exists under a different filename. |
| Project already uses a different dependency-boundaries tool (`eslint-plugin-boundaries`, etc.) | Don't install a second tool — port the rules in the template to whatever's already there. |

The template covers the rules that map directly to this skill's layer model (domain purity, thin `app/`, `state/` and `platform/` direction). It can't enforce the `ui/public/` cross-feature boundary — see the caveat in [composition.md](./composition.md).

## Tabs are routes, not features

**Tabs are UI structure** (where a user navigates). **Features are product capabilities** (what the system does). They sometimes align (a Profile tab maps to `features/profile/`); often they don't (a Home tab composes pieces from many features).

Don't make every tab a feature. Don't assume every feature has a tab. A feature is a product capability someone could write a sentence about — `checkout`, `search`, `onboarding`. Not "the home tab".

## Composing across features

Screens that pull together pieces from multiple features (e.g. a Home dashboard) live in a **host feature** (`home/`, `dashboard/`). Cross-feature imports use `features/<x>/ui/public/<File>` paths only — never reach into a feature's non-public `ui/`, `data/`, or `domain/`. `app/` route files count as cross-feature consumers; they too use `public/` paths.

**For the worked example, `app/` consumer rule, and global side-channel pattern (SDK event hubs, push handlers, websockets), read [composition.md](./composition.md) in this skill.**

## Where does this go?

| What you're writing | Goes in |
|---|---|
| New screen (private to the feature) | `features/<x>/ui/<X>Screen.tsx`. Route file in `app/` is one line. |
| Screen composing multiple features (Home, dashboard) | Host feature, e.g. `features/home/ui/HomeScreen.tsx`, importing from each contributing feature's `ui/public/` files |
| Public component a feature wants to expose to others | `features/<x>/ui/public/<Component>.tsx`. No barrel — the file *is* the public surface. |
| Business rule (eligibility, validity check, pricing rule) | `features/<x>/domain/<rule>.ts` as a pure function |
| **Pure reducer / state machine** (`(state, event) => state`, no side effects) | `features/<x>/domain/reducer.ts`. Side effects (logging, analytics, navigation) move to the hook that dispatches. |
| Cross-feature business rule | `shared/domain/<rule>.ts` |
| **Exception class thrown across feature boundaries** (caught by another feature) | `shared/domain/<concern>/`. Feature-internal exceptions stay in `features/<x>/domain/`. |
| Mutation/query hook | `features/<x>/data/use<X>.ts` |
| Top-level React Context provider for a feature (composes hooks, owns reducer dispatch, wraps children) | `features/<x>/ui/<X>Provider.tsx`. If mounted from the app's root layout, also expose under `features/<x>/ui/public/`. |
| Pure formatter (date, phone, currency) | `platform/formatters/` |
| Logging, analytics, env, device info, secure storage, auth tokens for HTTP clients | `platform/<concern>/` (vendor SDKs allowed) |
| Form-shape validation (UI only) | Co-located with the screen/hook |
| Validation that encodes a business rule | `features/<x>/domain/` |
| Wire-format parser (JSON → typed) | `features/<x>/data/` |
| Interpretation of parsed data (e.g. "this means access denied") | `features/<x>/domain/` |
| Cross-feature teardown touching multiple features' state (e.g. logout) | `state/<verb>.ts` as a named function (e.g. `resetAllAppData()`). The owning feature's hook calls it; the feature never imports another feature's `data/`. |

Cross-feature teardown sits in `state/` because it's the only placement that avoids one feature importing another feature's API slice (e.g. auth importing a content feature's API). Name the function for what it does, not who calls it, so future cross-feature resets reuse it instead of each feature growing its own.

## Shape rules

- **Domain functions** take **branded domain types** (`UserId`, `OrderId`), not `string`/`number`. Branded types live in `shared/domain/ids.ts`.
- **Domain functions** return **discriminated unions** for results, not booleans: `{ allowed: true } | { allowed: false; reason: ... }`.
- **Hooks** subscribe to reactive sources (your state layer — Redux, Zustand, Apollo, React Query, Context) and call domain or application functions. **A hook containing a conditional over business state is wrong** — push the conditional into a domain function.
- **Components** receive props and render. Local UI state (open/closed, hovered) is fine. Importing from `**/domain/**` is a smell — go through a hook.

## Common rationalizations

Common reasoning errors when placing code (with the right answer for each) are in [rationalizations.md](./rationalizations.md). **Consult when uncertain about placement, when your reasoning matches "everyone else does it that way", or when reviewing a PR and trying to articulate why a placement feels wrong.**

## Adopting this incrementally

Retrofitting onto an existing codebase rather than starting fresh:

- New code in `features/`, `shared/`, `platform/` **may import** from the pre-existing structure (whatever it is) while that code is migrated over time.
- New code **must not create new files** in the directories being phased out — freeze them, migrate their contents opportunistically.
- Lint enforces the layer rules above; the freeze-on-old-directories rule is enforced by reviewers until (or unless) tooling catches it too.

## Side effects (logging, analytics, navigation)

- `domain/` is pure. **No `log`, no analytics, no `Date.now()`, no navigation, no React imports.** Inject `now: Date` and return data; let the caller emit side effects.
- `data/`, `ui/`, and `platform/` may emit side effects. The typical shape: `domain/` returns `{ kind: 'denied', ... }`; the hook in `data/` or `ui/` switches on `kind` and calls `log.info(...)`.
- `platform/` is allowed to depend on vendor/framework SDKs (analytics, crash reporting, secure storage, push, etc.). The "no framework imports" rule applies to `domain/` only.

## App-boot side channels (global listeners, SDK hubs, websockets)

Global SDK listeners (auth event hubs, push notifications, websockets, deep links) register **once at app boot** inside the owning feature's top-level provider. Handlers dispatch into reactive state; reducer/handler logic stays pure in `domain/`.

**Full pattern in [composition.md](./composition.md) in this skill.** Read that file when wiring any global listener.

## Self-check before writing code

1. Is this a **business rule**? → `features/<x>/domain/` or `shared/domain/`. Pure function. Branded types. Discriminated union return. Test every branch.
2. Is this **talking to an API**? → `features/<x>/data/`. Returns domain types, not wire types.
3. Is this **reactive composition**? → a hook in `features/<x>/ui/`. No business conditionals inside.
4. Is this **infrastructure** (logging, analytics, formatting)? → `platform/<concern>/`.
5. None of the above? Ask, don't guess.
