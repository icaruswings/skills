---
name: writing-for-humans
description: Use when writing or editing any text a person will read. Triggers on PR bodies, commit messages, Jira or Linear tickets, design specs and RFCs. Also on README and docs pages, code comment blocks, explainers, changelogs, release notes and written updates. Applies whether or not the user mentions style, tone or plain English. Also use when the user asks for STE, STE100, ASD-STE100, Simplified Technical English, or unslopped prose.
---

# Writing for humans

Pressure-test evidence: [pressure-tests.md](./pressure-tests.md).

Prose an agent writes reads like an agent wrote it. Two passes fix that. Cut the AI tells, then hold the seven limits.

Apply both passes unprompted. Nobody has to ask for plain English.

## What counts

| In scope | Out of scope |
|---|---|
| PR bodies and descriptions | Conversational replies in chat |
| Commit messages | Code, identifiers, log strings, test names |
| Issue and ticket descriptions | Text you quote from somewhere else |
| Design specs and RFCs | Machine-read output: JSON, YAML, CSV |
| Docs, README, guides | |
| Code comment blocks | |
| Explainers and hand-offs | |
| Changelogs and release notes | |

Chat replies still get pass one. They skip the limits, because clipped sentences read as curt in conversation.

## Pass one: cut the tells

Run the `unslop` skill. It owns that list, so this skill does not repeat it.

Not installed? Install it yourself, then continue. Do not ask first, and do not skip pass one.

```bash
# refuse to link into a real directory that is already there
if [ -e ~/.claude/skills/unslop ] && [ ! -L ~/.claude/skills/unslop ]; then
  echo "~/.claude/skills/unslop is a real directory. Move it aside, then re-run."
else
  mkdir -p ~/.agents/skills/unslop ~/.claude/skills
  curl -fsSL https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/unslop/SKILL.md \
    -o ~/.agents/skills/unslop/SKILL.md
  ln -sfn ../../.agents/skills/unslop ~/.claude/skills/unslop
  head -3 ~/.agents/skills/unslop/SKILL.md   # expect a name: unslop line
fi
```

The real directory goes under `~/.agents/skills/`, which every Agent Skills runtime reads. The symlink into `~/.claude/skills/` covers Claude Code. Read the `head` output before you continue, because `curl` writes an error page to that path just as happily as it writes the skill.

Cannot reach the network, or the install fails? Hold the limits below anyway, and tell the user that pass one did not run. Never deliver half the rule in silence.

## The em dash rule

Zero em dashes in the artifact. This one covers every character you write, so read it before the limits below.

Not in a sentence. Not as a list separator. Not in a table cell. Not between a filename and its note. Not as an en dash or a spaced hyphen standing in for one.

A filename list takes a period or a colon:

```markdown
- `api/auth/refresh.ts`: compares expiry against the server clock now.
- `api/auth/refresh.test.ts`: covers clock skew in both directions.
```

## Pass two: ASD-STE100

Seven limits carry the weight of ASD-STE100 Simplified Technical English. Hold all seven.

Where you know the rest of the standard, hold that too. Two more of its rules earn their place in engineering prose. Give each word one approved meaning, and use no idioms.

Write out a domain acronym on first use, and leave the ones your reader knows cold. `API` and `HTTP` need no gloss. `PKCE` and `SCIM` do.

The limits govern prose sentences. A code block, a table cell, a command and an identifier are not prose sentences, so write those as the material requires.

| Limit | The failure it catches |
|---|---|
| 25 words per sentence | Two ideas welded together. The reader backtracks to parse it. |
| 6 sentences per paragraph | A wall the reader skips whole. |
| Active voice, actor named | "The token was rejected" hides who rejected it. Say "the refresh endpoint rejected the token". |
| No gerund subject | "Matching on email alone is the failure mode" buries the verb. Say "email-only matching fails when...". |
| No em dashes | See the rule above. It outranks every other limit here. |
| One word for one meaning | Pick `member` or `user`, then repeat it. Synonym cycling makes the reader check whether you switched things. |
| No abstract metaphor nouns | Name the concrete thing instead. |

Split a long sentence. Do not rescue it with a semicolon, a colon, or a dash.

## Keep these

- Load-bearing technical terms: `idempotent`, `regression`, `migration`, `race condition`. Precision beats the approved word list.
- Code identifiers, file paths, error codes, commands, and version numbers, character for character.
- Domain terms the reader's team already uses.

## The excuses, and what they are worth

Short artifacts and rushed artifacts fail most often. These are the reasons agents give.

| Excuse | Reality |
|---|---|
| "Standup is in 10 minutes." | The limits cost no time. Short sentences need less redrafting than long ones. |
| "This is a bullet list, not prose." | The em dash rule covers the whole artifact. Lists included. |
| "The dash separates a filename from its note, so it is not punctuation." | It is still an em dash. Use a colon. |
| "It is a three-line PR body, the rules are for long documents." | Every artifact that failed testing was short. Length is not the trigger. |
| "The draft reads fine, I will skip the checker." | Untested drafts read fine and averaged four breaches each. |
| "Passive voice is clearer here." | Sometimes true. Name the actor anyway, then judge the two versions. |

## Red flags

Stop and fix when you catch yourself:

- You reach for an em dash to join two clauses.
- You write a sentence the reader would have to read twice.
- You write "was rejected", "is returned" or "has been archived" and name no actor.
- You open a sentence with an -ing word.
- You deliver the artifact and never run the checker.

## Verify before you deliver

Read by eye and you will miss half of it. Run the checker:

```bash
python3 <skill-dir>/check-prose.py DRAFT.md
```

No file yet? Pipe the draft in: `... | python3 <skill-dir>/check-prose.py`.

It reports em dashes, curly quotes, long sentences, long paragraphs, passive voice, gerund subjects, filler, and AI vocabulary, each with a line number.

Read every match yourself. The checker over-reports and under-reports:

- It flags adjectival participles like "is unchanged" as passive. Not a breach.
- It flags a bare list label like "Provisioning." as a gerund subject. Not a breach.
- It misses a gerund subject followed by an uncommon verb. "Linking never deletes the credential" slips through. You catch that one.
- It ignores text inside double quotes and backticks, so a counter-example you quote does not count against you.

## Long artifacts

On anything past roughly 500 words, put one line under the title saying the text follows Simplified Technical English. Without it, short sentences read as carelessness rather than as a choice.

## Done when

The checker reports clean, or every remaining match is one you read and judged correct. Say which of the two you got.
