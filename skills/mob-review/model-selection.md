# Setting a reviewer's model

Use the harness's own model field. A prompt that says "use the strongest model" changes nothing.

| Harness | How |
|---|---|
| Claude Code | Pass `opus` (strongest), `sonnet` (mid-tier) or `haiku` (cheap) in the Agent or Task tool's `model` field. Use a general-purpose agent with the lens in its prompt. |
| Codex | Pass a model ID from the session's model catalog in the spawn tool's `model` field, with high reasoning effort for Security and triage. If overrides need `fork_turns: "none"`, use it and put the whole brief in the prompt. |
| Anything else | Use its documented model field. With none, the reviewer inherits your model: say so in the report. |

If a model is rejected, retry once with another at the same tier or higher. Don't guess at model names. Report the model you set for each reviewer.
