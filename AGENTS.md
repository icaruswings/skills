Every skill lives at `skills/<name>/SKILL.md`. There are no category folders. Reference files that a `SKILL.md` points to sit beside it in the same folder.

Each skill needs an entry in the top-level `README.md` that links its name to its `SKILL.md`.

Every `SKILL.md` is either user-invoked or model-invoked. A user-invoked skill sets `disable-model-invocation: true` and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`, so only the human can reach it. The model or the user can reach a model-invoked skill. See [.agents/invocation.md](./.agents/invocation.md).

Run `node scripts/check-skills.mjs` after you add, rename, or remove a skill. It checks the rules above.

To start a new skill, draft it with the `writing-skills` skill. Then follow [.agents/writing-skills.md](./.agents/writing-skills.md) to put it in this repo.

To link every skill into the local skill folders (`~/.claude/skills`, `~/.agents/skills`), run `scripts/link-skills.sh`. Each entry is a symlink into this repo, so a `git pull` keeps the linked skills current. Run the script again after you add, remove, or rename a skill.

The repo root is also a plugin for Claude Code and Codex, named `icaruswings`. `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` must keep the same name, version, and description. Every change under `skills/` bumps `version` in both files: minor for a new skill or a change in behaviour, patch for a fix. The plugin has no hooks, because Codex CLI does not run plugin hooks. `node scripts/check-skills.mjs` checks the manifests and the version bump, and `node --test 'scripts/*.test.mjs'` tests those checks.

This repo is public. Never put a company name, a project or repo name, a person, or an internal URL from any project that uses these skills into a skill, an example, a test, or a commit message. Use made-up values.
