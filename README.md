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

The script makes a symlink to each skill in `~/.claude/skills` and `~/.agents/skills`. A `git pull` then updates every skill that you linked. Run the script again after you add or rename a skill.

To take one skill only, copy its folder:

```bash
cp -R skills/mob-review ~/.claude/skills/
```

## The skills

The agent can select any of these on its own. You can also type the name of one.

- **[code-standards](./skills/code-standards/SKILL.md)**. Design rules from SOLID and Sandi Metz, ports and adapters patterns, security defaults, and wire changes that stay backwards compatible.
- **[mob-review](./skills/mob-review/SKILL.md)**. Selects the review passes that match the change. Each pass runs on its own. The findings come back in order of risk, not in the order of discovery.
- **[react-native-architecture](./skills/react-native-architecture/SKILL.md)**. A feature-first layered architecture for React Native apps. It includes a decision table that shows where new code belongs.
- **[writing-for-humans](./skills/writing-for-humans/SKILL.md)**. Cuts the AI tells from any text that a person reads, then holds seven Simplified Technical English limits. It includes a checker script that reports each breach with a line number.

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
