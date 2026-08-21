# Writing a skill

A skill is a document an agent reads *instead of* guessing. It earns its place by changing behaviour — if the agent would do the same thing without it, delete it.

Draft `SKILL.md` with the `writing-skills` skill (Superpowers) — invoke it to scaffold and write the skill itself. That skill knows nothing about this repo, so this file covers what it doesn't: where the result goes and how it wires in. Once drafted, move it to `skills/<name>/` and finish the steps below.

## Shape

```
skills/<name>/
  SKILL.md              # the skill itself
  agents/openai.yaml    # Codex metadata (+ invocation policy)
  <reference>.md        # optional: loaded only when SKILL.md points at it
```

`SKILL.md` is the whole skill unless it stops fitting in the head. Split a reference file out when a chunk is long, is only needed on one branch, or is a template to be copied — and point at it from `SKILL.md` by relative path. Everything the agent needs on the common path stays in `SKILL.md`.

## Frontmatter

```yaml
---
name: <matches the directory name, kebab-case>
description: <see below>
argument-hint: "<optional: what the user can pass>"
disable-model-invocation: true  # user-invoked skills only
---
```

The `description` is the only part the agent sees before deciding to load the skill, so it does the routing:

- **Model-invoked** — write it model-facing and trigger-rich: what the skill does, plus the situations and phrasings that should fire it ("Use when the user wants…, mentions…, asks for…").
- **User-invoked** — write it human-facing: one line a person scanning slash-commands can act on. No trigger list.

See [invocation.md](./invocation.md) for the full split.

## Codex metadata

`writing-skills` won't create `agents/openai.yaml` — it's specific to this repo's Codex support. Add it by hand, beside `SKILL.md`:

```yaml
interface:
  display_name: "Skill Name"
  short_description: "One short line for the Codex skill picker"
# User-invoked skills only — pair with disable-model-invocation: true in SKILL.md.
# policy:
#   allow_implicit_invocation: false
```

## Body

- **Write instructions, not prose about instructions.** Second person, imperative. "Read the failing test first" beats "it is often helpful to read the failing test".
- **State the constraint that makes the skill non-obvious** — the thing the agent would otherwise get wrong. That line is the skill; the rest is scaffolding around it.
- **Be short.** Every token competes with the user's actual task for the context window. Cut anything the agent already knows.
- **Name the branches.** Where the skill forks, use a list or a table with the condition on the left and the action on the right — never a paragraph the agent has to parse to find its case.
- **Give it a leading word.** One memorable term (*tracer bullet*, *deep module*, *red-green*) makes the skill reachable later, by both the agent and you.
- **Say when to stop.** A skill without a done-condition runs forever or quits early. Close with what "finished" looks like.
- **Don't hardcode paths, tools, or repo names** the skill can discover, and don't assume this repo — a skill runs in the user's project, not here.

## Done when

- Skill lives at `skills/<name>/`.
- `name` matches the directory; `description` routes correctly for the invocation mode.
- `agents/openai.yaml` exists and agrees with the invocation mode.
- Linked from the top-level `README.md`.
- `node scripts/check-skills.mjs` passes.
- `scripts/link-skills.sh` re-run, so the installed copy matches.
- You have run the skill at least once, end to end, on real work — and it changed what the agent did.
