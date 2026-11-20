---
# Copy this file to .agents/project.md in your project and edit it.
# Skills in the icaruswings plugin read it. Delete any key you don't need:
# a skill works out a missing value and says what it assumed.

default_branch: main            # the branch PRs merge into
verify: pnpm verify             # the command that must pass before a PR
---

<!--
Each section below overrides the skill it is named after. Keep only what is
true for this project; delete the rest.
-->

## workflow
Every new feature starts behind a feature flag.
Put the ticket key after the branch prefix: `fix/ABC-123-short-name`.

## mob-review
<!-- The workflow skill runs mob review in loop mode with subagents.
To turn that off, write it here, e.g. "Ask before fixing review findings."
or "Ask before using subagents." -->
Add a Security lens to every change that touches authentication.

## code-standards
Keep business logic out of UI components.
