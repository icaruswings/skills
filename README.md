# Skills

Agent skills that I use in my daily work. Each one is a Markdown file that an agent reads before it starts a task.

There is no registry and no plugin here. Clone the repo, or copy the one folder that you want. Change anything that you keep.

## Use them

Clone the repo, then link every skill into your agent:

```bash
git clone https://github.com/icaruswings/skills.git
cd skills
scripts/link-skills.sh
```

The script makes a symlink to each skill in `~/.claude/skills` and `~/.agents/skills`. A `git pull` then updates every skill that you linked. Run the script again after you add, remove, or rename a skill: it adds the new links and clears out the stale ones. It does not delete your files or directories, and it only removes links that match the ones it writes. Move anything of yours out of the way first if it reports a clash.

To take one skill only, copy its folder:

```bash
cp -R skills/mob-review ~/.claude/skills/
```

`writing-for-humans` runs `unslop` for its first pass, so take both. With the `skills` CLI:

```bash
npx skills add icaruswings/skills --skill writing-for-humans unslop
```

## The skills

The agent can select any of these on its own. You can also type the name of one.

- **[babysit-pr](./skills/babysit-pr/SKILL.md)**. Watches a pull request through CI and review with one watcher (`watch_pull_request` in T3 Code, `pr-wait` elsewhere). It fixes what fails and merges only when you ask. By Theo Browne: an unchanged copy of [t3dotgg/tstack](https://github.com/t3dotgg/tstack/tree/6efae364/skills/babysit-pr) at `6efae364`, under his MIT licence (`LICENSE` in the folder). Fixes go to his repo first.
- **[code-standards](./skills/code-standards/SKILL.md)**. Design rules from SOLID and Sandi Metz, ports and adapters patterns, security defaults, and wire changes that stay backwards compatible.
- **[leaving-pr-comments](./skills/leaving-pr-comments/SKILL.md)**. Marks every GitHub comment an agent posts for you with a short note that names the model. It keeps the comment itself short and backed by evidence. By Theo Browne: an unchanged copy of [t3dotgg/tstack](https://github.com/t3dotgg/tstack/tree/6efae364/skills/leaving-pr-comments) at `6efae364`, under his MIT licence (`LICENSE` in the folder). Fixes go to his repo first.
- **[mob-review](./skills/mob-review/SKILL.md)**. Selects the review passes that match the change. Each pass runs on its own. The findings come back in order of risk, not in the order of discovery. A team policy can turn on loop mode, which fixes and reviews again without stopping to ask.
- **[react-native-architecture](./skills/react-native-architecture/SKILL.md)**. A feature-first layered architecture for React Native apps. It includes a decision table that shows where new code belongs.
- **[unslop](./skills/unslop/SKILL.md)**. Cuts the AI tells from any draft. `writing-for-humans` runs it first, so the copy here saves a download. By Lauren Tan: a copy of [PStack](https://github.com/cursor/plugins/tree/2f87c854fe3e/pstack/skills/unslop) at `2f87c854fe3e`, under the MIT licence (`LICENSE` in the folder). One line differs. Upstream sets `disable-model-invocation: true`, which would stop `writing-for-humans` and other agents from running it, so this copy leaves it out. Fixes go to PStack first.
- **[writing-for-humans](./skills/writing-for-humans/SKILL.md)**. Runs `unslop` on any text that a person reads. Then it holds three limits from Simplified Technical English: 25 words per sentence, active voice with a named actor, and no -ing subjects. A checker script reports each breach with a line number.

## Using mob-review

Ask for a review in your own words. The agent also starts one when it finishes a change.

```text
mob review this before I push
review PR 42
review the plan in docs/plans/checkout.md
```

The agent picks the lenses that match the change and tells you which ones it skipped. A lens is one review pass with one focus, such as Security or Operability. A one-word typo fix gets a quick check and no panel.

### The two questions

By default the review stops twice to ask you:

1. Before it starts, if it can use subagents. One subagent per lens gives each lens its own context, so no lens copies another.
2. After the report, what to fix. The report numbers each finding, so you can answer by number:

   ```text
   How do you want to proceed? Fix all, fix the blockers only (#1, #4), fix by number, or leave it with you?
   ```

The review changes no files until you answer.

### Answer the questions ahead of time

Write a standing policy in `AGENTS.md`, `CLAUDE.md`, or the `## mob-review` section of `.agents/project.md`. The policy must name mob review:

```markdown
## mob-review
Use subagents for mob review without asking, and run it in loop mode.
```

What you say in the conversation overrides the policy. "Ask before you fix anything" turns loop mode off for that review.

### Loop mode

Loop mode fixes the blockers and should-fixes, then runs a second round. That round checks only the fixes. Each lens reports, for each of its findings, whether the fix worked or caused a new problem. The loop never changes a call that other code relies on, and it never accepts a blocker for you. The report ends with this block:

```text
Status: #1 fixed, #2 fixed, #3 needs a decision
Simplicity pass: nothing removed
Round 2: Security (opus): #1 resolved. Billing (sonnet): #2 resolved
Verify: npm test, 12 of 12 pass, run once after round 2
Decisions:
1. Should the support tool send an idempotency key? Options: a, b. I recommend a because ...
```

### Add a lens for your project

Add a lens in the same `## mob-review` section:

```markdown
Add a **Billing** lens for any change under `src/billing/`: money is integer cents, and refunds never exceed the captured amount.
```

## Layout

```
skills/<name>/SKILL.md   the skill itself
skills/<name>/           reference files that SKILL.md points to
.agents/                 how to write a skill for this repo
scripts/                 link the skills, list them, check the wiring
```

## Work on the skills

```bash
node scripts/check-skills.mjs   # check the wiring
scripts/link-skills.sh          # install the skills locally
```

To write a new skill, draft it with the `writing-skills` skill. Then follow [.agents/writing-skills.md](./.agents/writing-skills.md) to put it in this repo.

[AGENTS.md](./AGENTS.md) holds the conventions for this repo, and `CLAUDE.md` is a symlink to it. [.agents/invocation.md](./.agents/invocation.md) covers the split between user-invoked and model-invoked skills.

## License

[MIT](./LICENSE)
