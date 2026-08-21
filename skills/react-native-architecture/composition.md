# react-native-architecture: Composing screens and global side channels

Reference detail for the `react-native-architecture` skill. Read this when:

- Building a screen that pulls together pieces from multiple features (e.g. a Home dashboard).
- Wiring a global SDK listener (auth event hub, push notifications, websocket subscription, deep-link handler) into a feature.
- Deciding whether something belongs in `app/`, in a host feature, or in `shared/`.

For the layer rules and decision table, see `SKILL.md` in this skill.

## Composing across features

Tabs are routes; features are product capabilities. When a screen pulls together pieces from multiple features (e.g. a Home dashboard with a promo CTA + account badge + recent activity):

1. **The composing screen lives in a "host" feature** — usually `home/`, `dashboard/`, or similar. Its `domain/` may be empty or thin; its `ui/` is mostly orchestration.
2. **Cross-feature UI imports use the `public/` subdirectory.** Each feature curates its public surface as files under `features/<x>/ui/public/`. Cross-feature consumers import those files directly. Anything outside `public/` is private to the feature.
3. **No barrel `index.ts` re-exports inside `features/`.** Direct imports only. Metro tree-shakes them better, and the file tree (not a barrel) defines the public/private boundary.
4. **No internal coupling between features.** A feature's `domain/`, `data/`, and non-public `ui/` are private. If feature A needs feature B's domain model, the shared model belongs in `shared/domain/`, not in B.
5. **Create a host feature when there's no natural owner.** Don't put composing screens in `app/`, `shared/`, or one of the contributing features arbitrarily.
6. **`app/` route files count as cross-feature consumers.** Routes are app shell, not part of any feature. They import from `features/<x>/ui/public/` like any other consumer — never from internals.

### Example: a Home tab composing 3 features

```
src/app/(app)/(tabs)/home.tsx                                # 1-line route
src/features/home/ui/HomeScreen.tsx                          # composes (private)
src/features/home/ui/public/HomeScreen.tsx                   # OR here, if exposed

src/features/promotions/ui/public/PromoCTACard.tsx           # public
src/features/promotions/ui/PromotionsScreen.tsx              # private (own feature only)
src/features/promotions/ui/components/InternalCard.tsx       # private

src/features/account/ui/public/AccountBadge.tsx              # public
src/features/activity/ui/public/RecentActivityList.tsx       # public
```

`HomeScreen` imports `<PromoCTACard>` from `@/features/promotions/ui/public/PromoCTACard` — never from `@/features/promotions/ui/components/InternalCard` or any non-`public/` path.

> Lint note: the "no cross-feature internals" rule and "no barrel files in `features/`" often need review enforcement rather than tooling — most dependency-boundary linters don't have ergonomic rules for "feature A may not import non-public files of feature B" out of the box. A custom lint rule (or `eslint-plugin-boundaries` with per-feature scopes) can close the gap.

## App-boot side channels (global listeners, SDK hubs, websockets)

Some integrations fire events outside React — auth event hubs, push-notification handlers, websocket subscriptions, deep-link listeners, background-task callbacks. These need a single registration point and must dispatch into normal reactive state.

The pattern:

1. **Listener registration lives in the feature that owns the side channel** (e.g. auth events → `features/auth/data/useAuthEvents.ts`).
2. **The hook is mounted exactly once at app boot**, typically inside the feature's top-level provider rendered from the app's root layout. Don't install a global listener inside a screen hook — it'll re-register on remount.
3. **Handlers dispatch into the feature's reactive state** (Redux, context, reducer). They do not directly update component state or imperatively navigate.
4. **The reducer/handler logic is still pure and lives in `domain/`.** Only the listener registration itself is impure.

Smell test: if a side-channel handler races with in-flight user actions (e.g. a token refresh firing while a sign-in challenge is in progress), that race lives in the reducer's state model, not in the listener.
