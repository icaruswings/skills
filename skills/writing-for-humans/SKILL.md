---
name: writing-for-humans
description: Use when writing or editing any text a person will read. Triggers on PR bodies, commit messages, Jira or Linear tickets, design specs and RFCs. Also on README and docs pages, code comment blocks, explainers, changelogs, release notes and written updates. Applies whether or not the user mentions style, tone or plain English. Also use when the user asks for STE, STE100, ASD-STE100, Simplified Technical English, or unslopped prose.
---

# Writing for humans

Run two passes on any text a person will read, whether or not anyone asks: cut the AI tells, then hold the limits below. A chat reply gets pass one only. Code, identifiers, quoted text and machine-read output get neither.

## Pass one: cut the tells

Run the `/unslop` skill.

If unslop is not available, run pass two anyway and tell the user that pass one did not run.

## Pass two: limits from ASD-STE100

These limits come from ASD-STE100 Simplified Technical English. They apply to prose sentences, not to code blocks, commands or identifiers.

- A sentence has 25 words at most. Split a longer one into two sentences.
- Use active voice and name the actor: "the refresh endpoint rejected the token", not "the token was rejected".
- Don't start a sentence with an -ing subject: "email-only matching fails when...", not "Matching on email alone is the failure mode".

## Check before you deliver

Run the checker on the draft:

```bash
python3 <skill-dir>/check-prose.py DRAFT.md
```

No file yet? Pipe the draft in: `... | python3 <skill-dir>/check-prose.py`.

Read the draft against all three limits. Review every checker match.

## Done when

The checker reports clean, or you read every remaining match and judged it correct. Say which of the two you got.
