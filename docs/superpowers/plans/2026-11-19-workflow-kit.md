# Workflow Kit Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `icaruswings/skills` as one plugin for Claude Code and Codex, and add four generic workflow skills that read a per-project facts file.

**Architecture:** The repo root is the plugin root. Two manifests and two marketplace files point at the existing `skills/` folder. A new `scripts/plugin-checks.mjs` holds pure check functions that `check-skills.mjs` calls, covered by `node:test`. New skills follow the repo's existing shape (`SKILL.md`, `agents/openai.yaml`, README link).

**Tech Stack:** Node 22 built-ins only (`node:test`, `node:assert`, `node:child_process`), Python 3 for `pr-wait`, Markdown skills.

**Spec:** `docs/superpowers/specs/2026-11-19-workflow-kit-design.md`

## Global Constraints

- **No commits.** Leave every change uncommitted. The owner reviews the whole change and asks for the commit. Each task ends with "leave uncommitted", not a commit step.
- **Touch only this repo.** Read the existing copies of these skills elsewhere on the machine. Never write outside `icaruswings/skills`, except in temp dirs made for verification.
- **No names.** No company name, repo name, check name, glossary term, person or internal URL from the source copies enters any file, test fixture or example. Use made-up values (`build`, `test`, `pnpm verify`).
- **Plugin and marketplace name:** `icaruswings` in all four files.
- **No hooks.** Codex CLI does not run plugin hooks.
- **Skill rules:** follow `.agents/writing-skills.md` and `.agents/invocation.md`. Draft each new skill with the `writing-skills` skill (Superpowers).
- **Upstream credit:** `babysit-pr` and `leaving-pr-comments` are hard forks of `t3dotgg/tstack` at `6efae364` (MIT). Keep a `LICENSE` file and the attribution line.
- **Facts file keys:** `default_branch`, `required_checks`, `merge` (`merge-queue | squash | rebase | merge`), `review_bots`, `verify`. Add no others unless a skill or script in this plan reads them.

## Review Focus

1. **No `.agents/project.md` in the project.** Every skill that reads facts must work without it, detect what it can (`gh`, `git`), and say which values it assumed. Each skill's pressure scenario includes this case (Tasks 3, 4, 5, 6, 7).
2. **A facts file with an unknown `merge` value or broken front matter.** The skill says what it couldn't read and falls back to detection, without guessing silently. Pinned in the Task 3 pressure scenario.
3. **The version check on a shallow clone or with no base ref.** It must print why it skipped, not crash and not pass silently. CI must fetch enough history for the check to run. Pinned in Task 2's tests and CI change.
4. **Plugin installed alongside `link-skills.sh` links.** Every skill shows up twice. The README warns about it (Task 8). End-to-end verification uses isolated homes so it doesn't hide the problem (Task 9).
5. **`pr-wait` with no `python3` on PATH.** `babysit-pr` must say what to do instead (poll with `gh pr checks` and `gh pr view`). Pinned in the Task 3 pressure scenario.

---

### Task 1: Plugin manifests, marketplaces and their checks

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`
- Create: `scripts/plugin-checks.mjs`
- Create: `scripts/plugin-checks.test.mjs`
- Modify: `scripts/check-skills.mjs` (call the new checks before the summary line)

**Interfaces:**
- Produces: `checkPluginFiles(files: { claudePlugin, codexPlugin, claudeMarketplace, codexMarketplace }) => string[]`. Each argument is a parsed JSON object or `null` if the file is missing. It returns one error string per problem, and an empty array means pass.
- Produces: `loadPluginFiles(repoRoot: string) => { claudePlugin, codexPlugin, claudeMarketplace, codexMarketplace }`. It reads the four paths and returns `null` for a missing file. It throws with the path in the message on invalid JSON.

- [ ] **Step 1: Write the manifests.**
  - **Both `plugin.json` files:** `name: "icaruswings"`, `version: "0.1.0"`, the same `description`, plus `author`, `homepage`, `repository` and `license: "MIT"`.
  - **The Codex manifest also has:** `"skills": "./skills/"`, `"hooks": {}` and an `interface` block (`displayName: "icaruswings"`, `shortDescription`, `category: "Developer Tools"`), modelled on superpowers' `.codex-plugin/plugin.json`.
  - **Claude marketplace:** `name: "icaruswings"`, `owner`, `plugins: [{ name: "icaruswings", source: "./", description }]`.
  - **Codex marketplace:** `name: "icaruswings"`, `interface.displayName`, `plugins: [{ name: "icaruswings", source: { source: "local", path: "./" }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Developer Tools" }]`.

- [ ] **Step 2: Write the failing tests** in `scripts/plugin-checks.test.mjs` with `node:test`. Build fixtures in memory: a valid set, then one mutation per test.
  - `passes a matching set` → `[]`
  - `fails when a file is missing` → an error naming the missing path
  - `fails when names differ` → an error naming both values
  - `fails when versions differ` → an error naming both values
  - `fails when descriptions differ`
  - `fails when version is not semver` (`"1.0"`)
  - `fails when the Claude marketplace does not list icaruswings with source "./"`
  - `fails when the Codex marketplace does not list icaruswings with source.path "./"`

- [ ] **Step 3: Run the tests to confirm they fail.**
  Run: `node --test scripts/`
  Expected: FAIL, because `plugin-checks.mjs` does not export `checkPluginFiles`.

- [ ] **Step 4: Implement `checkPluginFiles` and `loadPluginFiles`** in `scripts/plugin-checks.mjs`, using built-ins only. Then call both from `check-skills.mjs` and push each returned string into its `errors` list.

- [ ] **Step 5: Run the tests and the repo check.**
  Run: `node --test scripts/ && node scripts/check-skills.mjs`
  Expected: all tests pass, and the output ends `✓ 5 skill(s) wired correctly.`

- [ ] **Step 6: Smoke-test installs in isolated homes,** so the owner's own config is never touched.
  ```bash
  T=$(mktemp -d)
  CLAUDE_CONFIG_DIR=$T/claude claude plugin marketplace add "$PWD"
  CLAUDE_CONFIG_DIR=$T/claude claude plugin install icaruswings@icaruswings
  CODEX_HOME=$T/codex codex plugin marketplace add "$PWD"
  CODEX_HOME=$T/codex codex plugin add icaruswings@icaruswings
  ```
  Expected: both installs succeed, and each tool lists `icaruswings` with the 5 existing skills.

  If either tool refuses the repo root (`"./"`) as a plugin source, stop and report back. The spec fixes the root layout, so a fallback needs the owner's call.

- [ ] **Step 7: Leave uncommitted.**

### Task 2: Version-bump check

**Files:**
- Modify: `scripts/plugin-checks.mjs`, `scripts/plugin-checks.test.mjs`, `scripts/check-skills.mjs`
- Modify: `.github/workflows/check.yml`

**Interfaces:**
- Consumes: `loadPluginFiles` from Task 1.
- Produces: `checkVersionBump({ changedFiles: string[], baseVersion: string | null, headVersion: string }) => string[]`. This function is pure.
- Produces: `gatherVersionInputs(repoRoot: string, baseRef: string) => { changedFiles, baseVersion } | { skipped: string }`. It shells out to `git diff --name-only <baseRef>...HEAD` plus `git diff --name-only HEAD` (uncommitted work counts too), and reads the base version with `git show <baseRef>:.claude-plugin/plugin.json`.

- [ ] **Step 1: Write the failing tests:**
  - `passes when nothing under skills/ changed` → `[]`
  - `passes when skills/ changed and version went up` (`0.1.0` → `0.2.0`) → `[]`
  - `fails when skills/ changed and version did not` → an error that says to bump `version` in both `plugin.json` files
  - `fails when the version went down` (`0.2.0` → `0.1.0`)
  - `passes when the base has no manifest` (`baseVersion: null`, the first release)
  - `gatherVersionInputs returns skipped with a reason when baseRef does not exist`. Use a temp git repo built in the test with `git init`, then `gatherVersionInputs(tmp, "origin/nope")`, and assert that `skipped` matches `/origin\/nope/`.

- [ ] **Step 2: Run the tests to confirm they fail.**
  Run: `node --test scripts/`
  Expected: FAIL, because the new exports are missing.

- [ ] **Step 3: Implement both functions.**
  - **Semver:** compare numerically, part by part. Write a tiny comparator; adding a dependency isn't allowed.
  - **Wiring in `check-skills.mjs`:** the base ref comes from env `CHECK_BASE_REF`, default `origin/main`.
  - **On `skipped`:** print `! version check skipped: <reason>` to stderr. Don't fail locally.
  - **In CI:** when env `CI` is set, a skip is a failure.

- [ ] **Step 4: Update `check.yml`.**
  - Checkout step: add `fetch-depth: 0`.
  - Add a step before the wiring check that runs `node --test scripts/`.
  - On `pull_request`, set `CHECK_BASE_REF: origin/${{ github.base_ref }}`.
  - On push to `main`, set `CHECK_BASE_REF: HEAD~1`.

- [ ] **Step 5: Run the tests and the repo check.**
  Run: `node --test scripts/ && node scripts/check-skills.mjs`
  Expected: all tests pass.
  - **Before Task 3 adds files under `skills/`:** the check passes, because the base has no manifest.
  - **After any later skill change:** it fails until the version is bumped.

- [ ] **Step 6: Leave uncommitted.**

### Task 3: `babysit-pr` skill

**Files:**
- Create: `skills/babysit-pr/SKILL.md`, `skills/babysit-pr/agents/openai.yaml`, `skills/babysit-pr/LICENSE`, `skills/babysit-pr/scripts/pr-wait`, `skills/babysit-pr/pressure-tests.md`
- Modify: `README.md` (skills list), `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` (`version` → `0.2.0`)

**Interfaces:**
- Consumes: facts keys `required_checks`, `merge`, `review_bots`, `default_branch`, and the `## babysit-pr` section of `.agents/project.md`.
- Produces: `scripts/pr-wait`, whose CLI is unchanged from the source: `pr-wait <pr> [--repo owner/name] [--until green|ready|any-change] [--interval 20]`, with exit codes 0/1/2.

- [ ] **Step 1: Baseline.** Run the RED step of the `writing-skills` skill: give a subagent with no skill the scenario "PR #12 is open with one failing check and two unresolved review threads; get it merged". Note what it gets wrong.

- [ ] **Step 2: Port `pr-wait`.** Copy the newest source copy and keep it in Python (the plan's call: it works, and a rewrite adds risk for no gain). Remove the 2 project-specific references. Then make the script read `required_checks` and `review_bots` from `.agents/project.md` front matter when present, and fall back to its current detection when not.

- [ ] **Step 3: Write `SKILL.md`** from the generic body of the newest source copy.
  - **Drop:** the "This repo" section and every harness-specific branch.
  - **Keep:** a one-line "if your harness has its own PR-watch tool, you may use it instead of `pr-wait`".
  - **First step:** read `.agents/project.md`. If it is missing, detect required checks with `gh` and say which values were assumed. Name each key it reads.
  - **No `python3`:** poll with `gh pr checks` and `gh pr view` instead.
  - **Attribution:** below the title, credit tstack at `6efae364` (MIT, see `LICENSE`).

- [ ] **Step 4: Write `agents/openai.yaml`** (model-invoked: `display_name: "Babysit PR"` and a short description) and add the README entry.

- [ ] **Step 5: Pressure-test.** Run the Step 1 scenario with the skill in three variants, and record the results in `pressure-tests.md`:
  - (a) with a facts file;
  - (b) with no facts file;
  - (c) with `merge: yolo` in the front matter.

  Expected: it follows the merge method from the facts. In (b) and (c) it says what it assumed and doesn't guess silently.

- [ ] **Step 6: Run the checks.**
  Run: `node --test scripts/ && node scripts/check-skills.mjs && python3 skills/babysit-pr/scripts/pr-wait --help`
  Expected: all pass, and the help text prints.

- [ ] **Step 7: Leave uncommitted.**

### Task 4: `leaving-pr-comments` skill

**Files:**
- Create: `skills/leaving-pr-comments/SKILL.md`, `agents/openai.yaml`, `LICENSE`, `pressure-tests.md`
- Modify: `README.md`, both `plugin.json` (`version` → `0.3.0`)

**Interfaces:**
- Consumes: the `## leaving-pr-comments` section of `.agents/project.md` (no front-matter keys).

- [ ] **Step 1: Baseline** with the scenario "leave review comments on this diff" against a small made-up diff with one real bug and one nit.
- [ ] **Step 2: Write `SKILL.md`** from the source's generic body. Swap the "This repo" section for a facts-file step, and keep the tstack attribution.
- [ ] **Step 3: Write `agents/openai.yaml`** (copy the invocation mode from the source copy) and add the README entry.
- [ ] **Step 4: Pressure-test** with and without a facts file, and record the results in `pressure-tests.md`.
- [ ] **Step 5: Run the checks.** `node --test scripts/ && node scripts/check-skills.mjs` should pass.
- [ ] **Step 6: Leave uncommitted.**

### Task 5: `branching` skill (superseded)

Don't build this task. On 2026-11-20 tests showed that only fetching first, branching from the remote default branch and stashing unrelated changes change what an agent does. Those lines are now `workflow` step 3 (Task 6). The evidence is in `skills/workflow/pressure-tests.md`.

### Task 6: `workflow` skill and the facts template

**Files:**
- Create: `skills/workflow/SKILL.md`, `agents/openai.yaml`, `project-template.md`, `pressure-tests.md`
- Modify: `README.md`, both `plugin.json` (`version` → `0.5.0`)

**Interfaces:**
- Consumes: facts keys `verify` and `default_branch`, the `## workflow` section, and the skills `mob-review` and `babysit-pr` by prose invocation (per `.agents/invocation.md`).
- Produces: `project-template.md`, the commented template with all five keys and one example section per skill. The README and the other skills point at it.

- [ ] **Step 1: Baseline** with the scenario "add a CSV export to the reports page" in a made-up project. Note where it skips planning, review and verification, and where it ignores PR rules.
- [ ] **Step 2: Write `SKILL.md`.**
  - **Description:** model-invoked. It fires at the start of any code change in a project that uses the plugin.
  - **Steps:** read facts → start the change → branch (step 3, folded in from Task 5) → build → verify (`verify` command) → review (`mob-review`) → open the PR (commit and PR rules here) → `babysit-pr` → handle scope changes.
  - **Where superpowers covers a step:** write "use superpowers' `<skill>` if it is installed, otherwise:" followed by a 2–4 line short version. This applies to brainstorming, writing-plans, requesting-code-review and verification-before-completion.
  - **Dependencies:** no declared dependency on superpowers.
- [ ] **Step 3: Write `project-template.md`**, using made-up values only.
- [ ] **Step 4: Write `agents/openai.yaml`** and add the README entry.
- [ ] **Step 5: Pressure-test,** and record the results:
  - (a) superpowers present;
  - (b) superpowers absent;
  - (c) no facts file.

  Expected: (a) hands off to the superpowers skills, (b) follows the short versions, and (c) states the assumed verify command.
- [ ] **Step 6: Run the checks.** They should pass.
- [ ] **Step 7: Leave uncommitted.**

### Task 7: Facts step in `mob-review` and `code-standards`

**Files:**
- Modify: `skills/mob-review/SKILL.md`, `skills/code-standards/SKILL.md`, both `plugin.json` (`version` → `0.6.0`)

**Interfaces:**
- Consumes: the `verify` key (mob-review only) and the `## mob-review` / `## code-standards` sections.

- [ ] **Step 1: Add one short step near the top of each skill:** read `.agents/project.md` if it exists, and let its section override this file. Change nothing else, as the spec limits this work to that one step.
- [ ] **Step 2: Re-run one existing scenario from each skill's `pressure-tests.md`,** with a facts section that changes one rule. Confirm the skill follows it, and append the result.
- [ ] **Step 3: Run the checks.** They should pass.
- [ ] **Step 4: Leave uncommitted.**

### Task 8: README and repo docs

**Files:**
- Modify: `README.md` (replace "There is no registry and no plugin here" with an Install section), `AGENTS.md` (plugin rules), `.agents/writing-skills.md` ("Done when" gains the version bump)

- [ ] **Step 1: Write the README Install section,** with exact commands for three paths:
  - **Claude Code plugin:** `/plugin marketplace add icaruswings/skills`, `/plugin install icaruswings@icaruswings`, the team-repo `.claude/settings.json` block (`extraKnownMarketplaces` + `enabledPlugins`), and the one `claude plugin install icaruswings@icaruswings --scope project` each person runs.
  - **Codex plugin:** `codex plugin marketplace add icaruswings/skills`, then `codex plugin add icaruswings@icaruswings`.
  - **One skill:** `npx skills add icaruswings/skills --skill <name>`.

  Then add two more pieces:
  - **"Use it in a project":** copy `skills/workflow/project-template.md` to `.agents/project.md`, and add the AGENTS.md line from spec §5.
  - **Duplicates warning:** don't use the plugin and `link-skills.sh` on the same machine.
- [ ] **Step 2: In `AGENTS.md`,** add: every change under `skills/` bumps `version` in both `plugin.json` files (minor for a new skill or behaviour, patch for a fix). Keep the manifests identical. Don't add hooks.
- [ ] **Step 3: Run the checks.** `node scripts/check-skills.mjs` should pass.
- [ ] **Step 4: Leave uncommitted.**

### Task 9: End-to-end verification and name-leak check

**Files:** none changed unless a check fails.

- [ ] **Step 1: Reinstall in fresh isolated homes** using Task 1 Step 6 (Claude Code and Codex).
  Expected: each lists 8 skills under `icaruswings`: the existing 5 plus `babysit-pr`, `leaving-pr-comments` and `workflow`.
- [ ] **Step 2: Install a single skill.**
  Run: `cd $(mktemp -d) && git init -q && npx -y skills add <repo path> --skill babysit-pr -y`
  Expected: `.agents/skills/babysit-pr/SKILL.md` exists, and `scripts/pr-wait` exists beside it.
- [ ] **Step 3: Run the full check.**
  Run: `node --test scripts/ && node scripts/check-skills.mjs`
  Expected: all pass.
- [ ] **Step 4: Name-leak check.** Ask the owner for the list of names. Run `grep -rniE '<names>' --exclude-dir=.git .` and expect no output. Don't write the list to any file.
- [ ] **Step 5: Leave everything uncommitted,** and report to the owner for review.
