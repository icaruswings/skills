# Model selection by harness

Read the active harness section before dispatch. Model selection changes inference cost, not the lens, evidence standard, or consent requirements. These defaults apply when the user/project has not chosen models; explicit constraints win, and any resulting quality gap stays visible.

“Use cheaper models” means the least-cost available model capable of the required tier. An explicit model restriction or budget cap remains binding. Availability alone does not establish capability: use the runtime's capability descriptions, official provider guidance, or an explicit project tier mapping. If none establishes a suitable equivalent, mark capability unknown.

## Claude Code

Map Economy → `haiku`, Balanced → `sonnet`, Strong → `opus`. Pass the alias through the exposed Agent/Task tool's `model` field when supported. A prompt saying “use Opus” is not a model override. Use a general-purpose reviewer with the chosen lens in its prompt; built-in exploration-only agents do not replace review lenses.

If invocation-level model selection is absent, an already installed custom subagent may set `model` in its YAML frontmatter. For example, a Balanced reviewer definition in `.claude/agents/mob-review-balanced.md`:

```yaml
---
name: mob-review-balanced
description: Run one assigned mob-review lens after the parent resolves consent.
model: sonnet
---
Review only the assigned lens and scope. Read the referenced diff, spec, and
surrounding code. Return evidence-backed findings tagged blocker, should-fix,
or optional, with file references and verification gaps. Change no files.
```

Definitions belong in `.claude/agents/` or `~/.claude/agents/`; a file in this skill's `agents/` folder is not installed as a Claude subagent. Use a matching Strong definition for Strong work. Do not create global definitions or change settings merely to run a review.

Aliases respect provider mappings through `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, and `ANTHROPIC_DEFAULT_OPUS_MODEL`. `CLAUDE_CODE_SUBAGENT_MODEL` supplies a default; before v2.1.251 it overrides invocation/frontmatter choices. On newer versions, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` can still force one model. Respect managed restrictions and inspect runtime warnings or `/tasks` for substitution. Record an unobservable effective model as unknown.

Sources: [subagent model controls](https://code.claude.com/docs/en/sub-agents#choose-a-model), [provider alias mappings](https://code.claude.com/docs/en/model-config#environment-variables).

## Codex

Choose IDs supported by the active provider and session. Current first-party defaults, when listed: Economy → `gpt-6-luna`, Balanced → `gpt-6.1-sol`, Strong → `gpt-6-astra`. Substitute catalog-confirmed equivalents by capability; model names are not portable to another configured provider.

Check the catalog of the client that actually launches the reviewer. App availability does not establish CLI availability. For example, the evaluated Codex CLI lists `gpt-6-sol` as its workhorse and rejected `gpt-6.1-sol` for its signed-in account, while app subagents accepted the latter. The benchmark records `gpt-6-sol` as its explicit Balanced equivalent; it does not silently substitute models or claim that the two clients evaluated the same model.

Use the exposed spawn tool's native `model` parameter. Set reasoning effort only through its supported field and values; effort alone does not select a cheaper model. If the tool requires `fork_turns: "none"` for overrides, use it and supply the complete review brief. A full-history fork that rejects overrides must not be labelled as tiered dispatch.

For clients using standalone custom agents, model configuration belongs in `.codex/agents/<name>.toml` or `~/.codex/agents/<name>.toml`. This is a valid Strong definition when those model/effort values are available:

```toml
name = "mob_review_strong"
description = "Run one assigned high-risk mob-review lens or final triage."
model = "gpt-6-astra"
model_reasoning_effort = "high"
developer_instructions = """
Review only the assigned scope using the provided mob-review contract.
Return evidence-backed findings, severity, file references, and verification
gaps. Change no files. For triage, preserve every lens's attribution.
"""
```

Use an installed definition only after checking its model settings: they take precedence over explicit spawn values. `[agents].default_subagent_model` and `default_subagent_reasoning_effort` are defaults, not per-lens routing. Keep existing global settings. `agents/openai.yaml` in this skill is discovery metadata, not a model selector. Older clients may expose different configuration; use their documented schema rather than inventing fields.

Source: [Codex subagent models and custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Fallbacks and completion

1. If a requested model/effort is rejected, retry once with a known available model at the required tier or above, within user constraints. Omit an unsupported effort override. Avoid repeating a failed ID or probing a list of guessed names.
2. If per-agent selection is unavailable, omit unsupported fields and use the inherited/default model, disclosing the limitation. Inheritance is not proof of Strong capability; check known defaults and runtime substitutions.
3. If the effective model is weaker than required or unknown, its findings remain useful, but rerun the affected lens and final triage on a confirmed adequate model before declaring the review complete. Otherwise report the gap and a verdict of **needs a decision from the user**. Never silently downgrade Security or final triage, or accept a blocker for the user.
4. If dispatch itself fails, report the failure and run separate self-review passes when feasible. Preserve completed lens results; count completed subagents/self-review passes in Mode (mixed mode when needed) and list failed attempts separately. An unperformed lens remains unverified and requires a needs-a-decision verdict; the review is incomplete. Self-review inherits the parent's model and the same tier gates. Consent still follows `SKILL.md`; a model-selection limitation does not grant permission to dispatch.

Report requested versus confirmed models separately. Claim savings only with measured usage/cost; these defaults express cost intent, not a measured result.
