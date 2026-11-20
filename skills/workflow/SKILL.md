---
name: workflow
description: Use at the start of any code change in a project that uses the icaruswings plugin or has an `.agents/project.md` — features, bug fixes, refactors — and again when the user changes scope mid-task.
---

# Workflow

The delivery loop from request to merged PR. It fills the gaps that
superpowers leaves; where superpowers covers a step and is installed, use it.

## 0. Read the project facts

Read `.agents/project.md` in the repo root if it exists. Its front matter and
its `## workflow` section override this file.

When the file, a key, or its front matter is missing or unreadable, run these
before you plan anything, and use what they return:

- Default branch: `git symbolic-ref refs/remotes/origin/HEAD`. If that fails,
  `git ls-remote --symref origin HEAD`, then
  `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. It is often
  not `main`. Never write `main` without having run one of these.
- Verify command: the script in `package.json`, `Makefile`, or equivalent
  that runs both lint and tests.

Then tell the user, in one line, the values you found and where from.

## 1. Size the change

| Change | Path |
| --- | --- |
| Docs, config, or test-only, and it doesn't touch CI, secrets, dependencies, or developer workflow | Steps 3, 4, 6, 7. Self-check instead of step 5. |
| Anything else | Every step |

## 2. Agree the approach before building

For a new feature or a change in behaviour: use superpowers' `brainstorming`
if it is installed, then `writing-plans` for multi-step work. Otherwise: say
back the request in one sentence, propose an approach with what it trades off,
and wait for the user to agree before you write code. A bug fix with a clear
cause skips this step.

## 3. Branch

Start from the remote default branch, not a local copy, which may be stale:

```bash
git fetch origin
git switch --no-track -c <type>/<short-name> origin/<default_branch>
```

If `git status --short` shows changes that aren't part of this task, stash
them first (`git stash push -u -m "<what they are>"`) and tell the user. Never
discard them.

## 4. Build and verify

Build with tests for the behaviour that can break. For a logic bug, write the
failing test first.

Run the `verify` command and read its output. If superpowers'
`verification-before-completion` is installed, use it. Otherwise: don't say
"done", "fixed", or "passing" until you have run the command in this session
and seen it pass. Report a failure with its output.

## 5. Review before the PR

Run the `mob-review` skill on your change, even when the project has a review
bot. A bot reviews the PR after it is open; this review catches problems
before anyone else spends time on them.

**Standing policy for mob review.** For the change this workflow delivers,
mob review runs in loop mode, and subagents are pre-approved for it: one per
lens, plus final triage. Don't stop to ask either question. Loop mode fixes
blockers and should-fixes, stops after two rounds, and still asks you when a
blocker stays open, a fix would change scope, or lenses disagree. A project
turns either part off in the `## mob-review` section of `.agents/project.md`.

## 6. Commit and open the PR

- Conventional Commits for commit messages and the PR title:
  `type(area): description`. Types: `feat`, `fix`, `docs`, `refactor`,
  `test`, `chore`, `ci`. Ticket keys and other formats come from the
  project's section.
- When PRs are squash-merged, the PR title becomes the commit on the default
  branch. Write it as that commit.
- Keep a PR small enough to review in one sitting. Split when it touches more
  than about ten files for separable reasons.
- Push and open the PR, ready for review.

## 7. Get it merged

Hand the PR to the `babysit-pr` skill.

## Scope changes

When the user asks for a change that departs from what was agreed, don't just
build it. Say what it costs, give concrete options with your recommendation
first, and let them pick.

## Lessons

When something in the task went wrong or cost extra steps (a wrong command or
path, a search that went in circles), ask what in the repo would have prevented
it. End your final report with one line for each repo change that would have
prevented it:

`Lesson: <what it cost this time> → <cheapest fix> in <file>`

The cheapest fix corrects or removes the cause. Next comes a script, lint rule
or test, and only then a new skill or `AGENTS.md` line.

## Done when

The PR is open, `mob-review` is clean or its remaining findings are listed,
and `babysit-pr` has it: merged if the user asked, otherwise reported ready.
