# Ship this repo as a Claude Code and Codex plugin

Date: 2026-11-19
Status: draft, waiting for approval

## Why

The same agent workflow has been rebuilt by hand in several repos: skills
to babysit a PR, run a mob review, leave PR comments and follow a branching
model, plus AGENTS.md sections on the review loop, PR rules and
verification. Each copy then changes on its own. One copy even says
"change both copies together", and nothing makes that happen.

Two earlier fixes did not hold. A custom distribution CLI stopped getting
maintained. `scripts/link-skills.sh` reaches one machine only, so
teammates never get the updates.

The aim: fix a workflow skill once in this repo, and every project that
uses it, every teammate and both agents (Claude Code and Codex) get the
fix.

## Goals

- This repo is the one source for generic workflow skills.
- It installs as one plugin in Claude Code and in Codex, the way
  `obra/superpowers` does, with skill names namespaced by the plugin
  (`<plugin>:babysit-pr`).
- Each skill can still be installed on its own, without the plugin, with
  `npx skills add icaruswings/skills --skill <name>`.
- A project's local facts (required checks, merge method, verify command)
  live in one small file that the project owns. Skills read it instead of
  being forked.
- A project's AGENTS.md takes the shared workflow with one line, not a
  pasted copy.

## Non-goals

- Changing any other repo. This work touches only `icaruswings/skills`.
  Adopting the plugin in a project is a later, separate change.
- A custom CLI, a sync bot, or vendored copies in projects.
- Project-specific skills (a project's architecture, theming, infra or
  tone of voice). Those stay in their projects.
- Other agents (Cursor, Gemini, and so on). The plugin layout should not
  rule them out, but this work ships Claude Code and Codex only.

## Anti-goals

These count as failures even if everything else works:

- **Company or project content in this repo.** The repo is public. No
  company name, repo name, check name, glossary term, person or internal
  URL from any project enters it, including in this doc, examples and
  commit messages. Examples use made-up values.
- **A project has to fork a skill to change one detail.** Every local
  difference must fit in the project facts file.
- **Two copies of one skill to maintain.** The plugin and the individual
  installs read the same `skills/<name>/` folder.

## Approaches considered

- **A. One plugin for Claude Code and Codex, built like superpowers.**
  *Chosen.* Updates reach users through the plugin's own update path. The
  plugin namespace stops a personal skill with the same name from hiding
  the shared one. The cost is a one-time install per person.
- **B. Vendored copies, pinned by the `skills` CLI and synced by a
  scheduled PR.** Rejected. It needs a prefix to avoid name clashes, a
  GitHub App token in each project so the sync PRs can run CI, and a
  workflow from this public repo running inside other projects' CI.
- **C. A and B together.** Rejected: two delivery paths to maintain.

## What the platforms allow (checked 2026-11-19)

- **Claude Code.** A project's `.claude/settings.json` can name a
  marketplace in `extraKnownMarketplaces` and the plugin in
  `enabledPlugins`. The marketplace is registered once the person trusts
  the folder. Each person still runs
  `claude plugin install <plugin>@<marketplace> --scope project` once.
  Source: code.claude.com/docs/en/plugins/org.
- **Codex.** A repo marketplace lives at `.agents/plugins/marketplace.json`
  (`.claude-plugin/marketplace.json` is read as a legacy location). Skills
  are found under `skills/<name>/SKILL.md`. Plugin metadata goes in
  `.codex-plugin/plugin.json`, as superpowers does. A project
  `.codex/config.toml` can enable only local-marketplace plugins, so for a
  remote marketplace each person runs `codex plugin marketplace add
  icaruswings/skills` and installs once. Plugin hooks run only in the
  Codex desktop app, for manually installed plugins.
  Source: developers.openai.com/codex/plugins/build.

Because Codex CLI does not run plugin hooks, the design uses no hooks.
Everything is delivered as skills, which both agents load the same way.

## Design

### 1. Repo layout

The repo root is the plugin root. `skills/` stays where it is, so
individual installs and `link-skills.sh` keep working.

```
.claude-plugin/plugin.json        Claude Code plugin manifest
.claude-plugin/marketplace.json   Claude Code marketplace, one plugin, source "./"
.codex-plugin/plugin.json         Codex plugin manifest, skills: "./skills/"
.agents/plugins/marketplace.json  Codex marketplace, one plugin, source "./"
skills/<name>/SKILL.md            unchanged
```

The two manifests share name, version and description. `check-skills.mjs`
fails if they differ.

### 2. Plugin and marketplace name

Both are named `icaruswings`. Skills then show as
`icaruswings:babysit-pr`. *(My call. Up to you to change before release:
this is the name people type.)*

### 3. New skills

These join the repo. Each is written fresh as a generic skill. Any
project-specific line from an existing copy goes to the project facts file
(section 4), not into the skill.

| Skill | What it does | Starting point |
| --- | --- | --- |
| `babysit-pr` | Watch a PR through CI and review, fix what fails, queue the merge. Ships `scripts/pr-wait`. | `t3dotgg/tstack` `skills/babysit-pr` at `6efae364` (MIT). Hard fork; keep the licence and attribution. |
| `leaving-pr-comments` | How to word and place GitHub review comments. | `t3dotgg/tstack` (MIT). Hard fork, same as above. |
| `workflow` | The shared process: starting a feature, the review loop, PR and commit rules, verifying before "done", handling scope changes. Replaces the AGENTS.md sections that get copied today. | Written fresh. |

`mob-review` and `code-standards` already live here. Each gains the
project facts step (section 4) and nothing else in this work.

`workflow` is model-invoked and says when the agent should load it: at the
start of any change to code in a project that uses the plugin.

**`workflow` fills the gaps that superpowers leaves.** It covers only what
superpowers doesn't: PR and commit rules, the mob-review loop, handing off
to `babysit-pr`, scope changes, and reading the project facts file. Where
superpowers has a step (brainstorming, writing-plans,
requesting-code-review, verification-before-completion), `workflow` says
"use superpowers' `<skill>` if it is installed, otherwise do this", followed
by a short version of that step. The plugin does not declare a dependency on
superpowers. *(Decided by the owner.)*

**`babysit-pr` works in any harness.** It waits on a PR with `pr-wait`. If
the harness has its own PR-watching tool, the skill may use that instead.
No step depends on one harness. *(My call.)*

**What ships.** The plugin ships every skill in `skills/`, including the
ones outside the workflow (`react-native-architecture`,
`writing-for-humans`, `unslop`). Each loads only when relevant, and one
source folder is simpler than a curated list. *(My call.)*

**Source material.** The builder reads the existing copies of these skills
on the owner's machine while writing the new ones. No path, repo name or
company name from those copies goes into this repo, the plan or commit
messages. *(My call.)*

### 4. Project facts file: `.agents/project.md`

Each skill that depends on project facts starts with one step: read
`.agents/project.md` if it exists. Its front matter and its section for
that skill override the skill's defaults.

```markdown
---
default_branch: main
required_checks: [build, test]
merge: merge-queue        # merge-queue | squash | rebase | merge
review_bots: [coderabbit]
verify: pnpm verify
---

## babysit-pr
Never use `gh pr merge`. Queue with the GraphQL mutation.

## workflow
Every new feature starts behind a feature flag.
```

If the file or a key is missing, the skill works out what it can (`gh` for
required checks and the default branch), says which value it assumed, and
carries on.

`skills/workflow/project-template.md` holds a commented template that a
project copies.

*(My call: file name, format and the starting keys. The builder adds a key
only when a skill or script reads it.)*

### 5. How a project's AGENTS.md uses it

The README shows the one line a project adds:

```markdown
## Workflow
Follow the `workflow` skill from the icaruswings plugin. Project facts are
in `.agents/project.md`.
```

Everything else in AGENTS.md (overview, glossary, architecture, commands,
pitfalls) stays the project's own.

### 6. Install instructions in the README

The README gets an "Install" section with three paths:

1. **Plugin, Claude Code:** `/plugin marketplace add icaruswings/skills`,
   then install `icaruswings`. For a team repo, the `.claude/settings.json`
   block plus the one install command each person runs.
2. **Plugin, Codex:** `codex plugin marketplace add icaruswings/skills`,
   then `codex plugin add icaruswings@icaruswings`.
3. **One skill:** `npx skills add icaruswings/skills --skill <name>`.

It also says not to use the plugin and `link-skills.sh` on the same machine,
because you'd get every skill twice (`mob-review` and
`icaruswings:mob-review`).

### 7. Versions and releases

The manifests carry a semver version. A change to any skill bumps it in the
same PR. `check-skills.mjs` fails if a file under `skills/` changed and the
version did not. Release tags (`v1.2.0`) let a project pin a ref if it
wants to.

## Done when

- `claude plugin install icaruswings@icaruswings` and the Codex equivalent
  both install from a local clone and list every skill under the
  `icaruswings:` namespace.
- `npx skills add <local path> --skill babysit-pr` installs one skill.
- `node scripts/check-skills.mjs` passes, including the new manifest and
  version checks.
- A search of the repo for any company or project name from the projects
  that will use it finds nothing. This is a manual check before release,
  against a list of names the owner gives at review time. The list is never
  committed. *(My call.)*

## Left to the builder

- The final key set for `.agents/project.md`.
- The wording of `workflow` and the facts step.
- Whether `pr-wait` stays in Python or moves to Node (this repo's scripts
  are Node).
