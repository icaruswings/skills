/**
 * Layer enforcement for the architecture in the `react-native-architecture`
 * skill (SKILL.md in this skill).
 *
 * Starting point, not a closed set — extend `no-framework-in-domain`'s
 * package list for your stack, and add rules as the layer model grows.
 * Cannot enforce the `ui/public/` cross-feature boundary; see the caveat in
 * composition.md in this skill.
 *
 * Run: npx depcruise --config .dependency-cruiser.cjs src
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-framework-in-domain',
      severity: 'error',
      comment:
        'domain/ is pure business logic — no React, no state library, no vendor SDKs. Extend this package list for your stack.',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: {
        path: [
          '(^|/)node_modules/react($|/)',
          '(^|/)node_modules/react-native($|/)',
          '(^|/)node_modules/@react-navigation/',
          '(^|/)node_modules/expo($|/)',
          '(^|/)node_modules/expo-',
          '(^|/)node_modules/@reduxjs/',
          '(^|/)node_modules/redux($|/)',
          '(^|/)node_modules/react-redux($|/)',
          '(^|/)node_modules/@apollo/',
          '(^|/)node_modules/@tanstack/react-query($|/)',
        ],
      },
    },
    {
      name: 'no-side-channels-in-domain',
      severity: 'error',
      comment: 'domain/ cannot reach into app routing, global state, or platform infrastructure.',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: { path: '^src/(app|state|platform)/' },
    },
    {
      name: 'no-feature-internals-in-domain',
      severity: 'error',
      comment: "A feature's domain/ cannot import from any feature's ui/ or data/. Domain stays pure.",
      from: { path: '^src/features/([^/]+)/domain/' },
      to: { path: '^src/features/[^/]+/(ui|data)/' },
    },
    {
      name: 'app-must-be-thin',
      severity: 'error',
      comment:
        "Route files in app/ are entry points only — they cannot import a feature's data/ or domain/, only its ui/.",
      from: { path: '^src/app/' },
      to: { path: '^src/features/[^/]+/(domain|data)/' },
    },
    {
      name: 'no-ui-in-data',
      severity: 'error',
      comment:
        "A feature's data/ cannot depend on its ui/. Data returns domain types; UI calls into data, not the reverse.",
      from: { path: '^src/features/[^/]+/data/' },
      to: { path: '^src/features/[^/]+/ui/' },
    },
    {
      name: 'no-feature-internals-in-state',
      severity: 'error',
      comment:
        "state/ owns cross-feature concerns and may not reach into a feature's data/ or domain/ — features call down into state/, never the reverse.",
      from: { path: '^src/state/' },
      to: { path: '^src/features/[^/]+/(data|domain)/' },
    },
    {
      name: 'no-features-in-platform',
      severity: 'error',
      comment: 'platform/ is cross-cutting infrastructure consumed by every layer; it may never depend on a feature.',
      from: { path: '^src/platform/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'no-platform-in-domain',
      severity: 'error',
      comment: 'domain/ may never import platform/ — that is exactly the infrastructure domain/ exists to stay free of.',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: { path: '^src/platform/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['\\.test\\.(ts|tsx)$', '__tests__', '__mocks__'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
