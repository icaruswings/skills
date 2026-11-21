# workflow pressure tests

Run on 2026-11-19 with a mid-tier model. "Fixture" is a made-up project whose
`AGENTS.md` points at `.agents/project.md`. "Git repo" is a made-up repo whose
default branch is `trunk`, with no facts file.

## Baseline (no skill)

Scenario: "Add a CSV export button to the reports page. Ship it." (fixture)

- Read `.agents/project.md` and followed its facts and sections.
- Skipped an independent review: "the review bot runs on the PR. I won't spawn a separate reviewer."
- No design step before building a feature: went straight to the flag and the code.

## With the skill

| Variant | Expected | Result |
| --- | --- | --- |
| Fixture, superpowers installed | Hands off to `brainstorming`, `writing-plans`, `verification-before-completion`; runs `mob-review` despite the bot; `babysit-pr` after | Pass |
| Fixture, no superpowers, scope change mid-task | Short-version steps; on "make it Excel instead", stops and gives costed options, recommendation first | Pass |
| Git repo, no facts file | Detects the default branch and verify command, says where they came from | Fail, then pass |

The first no-facts run said it would detect the default branch, then wrote
`main` (the real default is `trunk`). Step 0 now lists the commands to run and
says "never write `main` without having run this". The re-run used the
detected branch.

After review, step 0 also covers a facts file with missing keys, and falls back
to `git ls-remote --symref origin HEAD` when `origin/HEAD` isn't set. A test
with a partial facts file and no `origin/HEAD` passed before that change, so
the change brings the wording in line with the spec. No observed failure
prompted it.

## Loop mode by default (2026-11-20)

Scenario: workflow step 5 on an uncommitted change with a planted blocker (an
unvalidated discount percent from the request body). The project has a facts
file but no mob-review policy in `AGENTS.md`. A subagent tool is exposed.

| Variant | Expected | Result |
| --- | --- | --- |
| Before the change | Loops without asking, as step 5 says | Fail: stopped at mob-review's subagent question. Fixed nothing. Quoted the two skills disagreeing on who starts the fixes. |
| Step 5 as a standing policy | No consent question; `Loop mode: fixing` line; two rounds; simplicity pass; asks only about the `decision` finding | Pass |
| Project's `## mob-review` says "Ask before fixing review findings." | No consent question; one report ending on the how-to-proceed question; no edits | Pass |

The cause: mob-review counts only team instructions as a policy, and the
workflow skill isn't one. Step 5 now states the policy in mob-review's terms,
and mob-review names the workflow skill as a policy source.

## Branch step, folded in from `branching` (2026-11-20)

We drafted a separate `branching` skill, then tested it against the no-skill
baseline with a mid-tier model, 5 runs per cell. The test repo's default branch
is `trunk`, and `origin/HEAD` isn't set. A fake `gh` answers PR
questions.

| Scenario | No skill | `branching` | Workflow step 3 |
| --- | --- | --- | --- |
| Start a branch while on other work with uncommitted changes; local `trunk` is one commit behind | 0/5: all branched from the stale local `trunk` | 4/5: one lost the uncommitted work | 8/8, then 5/5 with `--no-track`; every run told the user about the stash |
| Update a stacked branch after its base PR was squash-merged and deleted; local base stale; base had review fixes | 5/5 | 5/5 | not run |
| Same, plus a teammate's commit on the stacked branch that the agent hasn't fetched | 5/5 | 5/5 | not run |
| Already on the task branch with a pushed commit; the user changes the task | not run | not run | 6/6 stayed on the branch |

In the stacked cases, the agents read the commit graph and rebased from the
base PR's last commit. In the teammate case, they fast-forwarded to it before
rebasing. The skill's stacking recipe, prefix table and "never commit to the
default branch" line changed nothing, so they were cut.

The lost work came from the skill's own command. `git switch -c … origin/trunk`
refused because a tracked file had local changes. The agent's next commands
ran anyway, the commit landed on the old branch, and `git reset --hard` to undo
it discarded the edit. Step 3 now says to stash unrelated changes first.

The rest fit in a few lines. It became workflow step 3, and we removed
`branching`.

The resume case shows that step 3 needs no "already on the task branch" clause.

`--no-track` stops the new branch from tracking the default branch, so a bare
`git push` can't target it. Every run pushed with an explicit `-u`, so no run
showed this failure. The flag fixes a hazard in the skill's own command.

Step 6 used to say `gh pr create --base <default_branch>`, which sends a stacked
PR to the wrong base. A bare `gh pr create` already targets the default branch
for a normal PR. With no base in the step, the agent can pass the parent
branch for a stacked PR. No run opened a stacked PR, so this rests on reasoning,
not on a test.

## Scope changes and Lessons (2026-11-20)

A mid-tier model ran each case, with the section injected alone, the whole
skill loaded, or neither. A second model graded each final report against a
fixed rubric. It scored each point on its own: did the report mention the
problem, propose a change, name the file, give the cost, and tie the fix to
that cost? I read the reports too. The repo is a small Node project.

"Whole skill, PR flow" runs add a remote and a fake `gh`, and the prompt doesn't say
"don't commit", so the agent works through to a PR. At 5 runs, a gap like 4/5
against 3/5 is noise.

### Scope changes

The agreed plan is a CSV export with no new dependencies, already built on a
branch. Columns name the text they ran: "first text" had a cap of two or three
options and a list of cost kinds; "current" is the section as it stands.

| Scenario | No section | First text, alone | Current, alone | Current, whole skill |
| --- | --- | --- | --- | --- |
| Plan only in `docs/plan.md`; the user asks "can you make it Excel instead?" | 0/5 stopped: all built it, hand-wrote a zip writer to dodge the dependency rule, and rewrote the plan | 5/5 stopped with costed options | 5/5 | 5/5 |
| Prompt restates the plan, then asks for Excel plus a weekly email | 5/5 already stopped | 5/5 | not run | not run |
| An in-scope tweak: put today's date in the file name | 5/5 just did it | 5/5 | 5/5 | 3/3 |

The grader marked "recommendation first" at 3/5 for the current text alone
and 4/5 in the whole skill. Read by hand, every run lists its recommendation as
option 1, and one hedges between options 1 and 2. Runs gave three or four
options whether or not the text capped them.

Cut after testing, because the casual request still stopped 5/5 without them:
"Don't end with an open 'what would you like?'", the "two or three" cap, and
the list of cost kinds.

### Lessons

The section closes the loop the way Every's `ce-compound` and `ce-retro` do.
When the task cost more than it should have, the agent proposes the cheapest
change to the repo that would stop it happening again.

Scenarios:

- **L0:** smooth task; the existing tests catch the bug.
- **L1:** `AGENTS.md` names `npm test`, which runs dead legacy tests.
- **L2:** `AGENTS.md` names a file that has moved.
- **L3:** an unused duplicate of the helper.
- **L4:** no error. Three copies exist, and only one is wired in, through a
  package alias.
- **L5:** the user's prompt names a wrong path, and the repo is correct.

Proposals that would stop a repeat, and how many tied the fix to its cost.
The "Current" column is the shipped text, run as the whole skill in the PR
flow: 4/5 L0, 5/8 L1, 6/8 L4 and 5/5 L5 runs reached `gh pr create`. The other
whole-skill columns are earlier versions.

| Scenario | No section | Prose, alone | Prose, whole skill | Current, whole skill, PR flow |
| --- | --- | --- | --- | --- |
| L0 | 0/5 padded | 0/5 padded | 0/5 padded | 5/5 wrote a line: 3 add `.agents/project.md`, 2 padding (a PR template, a pre-commit hook) |
| L1 | 0/5 | 7/8, tied 4/8 | 3/5, tied 1/5 | 8/8, tied 3/8, file named 8/8 |
| L2 | 2/5 | 5/5 (earlier prose) | not run | not run |
| L3 | 5/5 | 5/5 (earlier prose) | not run | not run |
| L4 | 3/5 | 6/8, tied 2/8 | 5/5, tied 0/5 | 7/8, tied 6/8 |
| L5 | 0/5 repo changes | 0/5 | not run | 5/5 wrote a line, none needing a repo change |

"Prose" is the section as two paragraphs, without the `Lesson:` line. It did
well alone. In the whole skill the proposal got lost in a long report, and
agents rarely tied the fix to its cost.

The current text, with its `Lesson:` line, improved on the earlier prose: every
L1 run proposed a fix and named the file, and L4 tied the fix to its cost in 6/8. The
form now matches the failure. The first slot often holds the cause rather than
the cost, which still gives cause, fix and file.

Earlier L0 and L5 runs said "don't commit", so the agent skipped the workflow.
In the PR flow the workflow itself adds a cost when `.agents/project.md` is
missing: step 0 makes the agent look up the default branch and verify command.

Three of the five L0 lines propose adding that file. That is a repeated cost
of the kind Every's `ce-retro` looks for, so I count it as a fair lesson. The
other two are padding.

On L5, three lines say `AGENTS.md` already has the path
and nothing needs to change, and two suggest fixing the request. Each is one
accurate line that changes no file. The old wording, run in the same PR flow,
also wrote a line on L0 3/5 and L5 5/5, so these lines come from the PR flow,
not from the new wording.

I tried two guards against those lines in the PR flow and cut both. Neither
stopped the L5 lines, and the first also suppressed the fair L0 lines:

- "Write no line when nothing cost extra steps, or when the repo already had
  the answer": L0 2/5 lines, L5 4/5.
- Adding "Never write a line that proposes no change": L0 3/8, L5 8/8.

L1 is the clearest case. Without the section, every report described the
broken command, and none proposed a change. L3 shows that agents already
propose deleting a dead copy, so there the section adds little.

L4 is the
"search that went in circles" case. Agents spent 3 to 12 tool calls, so the
friction was mild, and without the section 3/5 proposed the same deletion. L5
checks Every's counterfactual: the repo didn't cause the detour, and with
"don't commit" in the prompt no run wrote a lesson. In the PR flow the runs
wrote one line each, and none needed a repo change.

Ablations, with the earlier prose text alone:

- "When nothing went wrong, say nothing": cut. L0 and L5 stayed at 0/5 padded.
- "Propose, don't add": cut. L1 stayed at 5/5, and no run edited `AGENTS.md`.
  Only L1 tested this.
- The order of fixes: kept. Without it, proposals stayed at 5/5, but
  "tied to its cost" fell from 4/5 to 3/5 on L1 and from 4/5 to 0/5 on L4.

In the whole skill, a "Done when" line, "The final report includes any fix
that Lessons asks for", changed nothing: proposals went 5/8 with it and 4/8
without on L1, and 6/8 against 7/8 on L4. It was cut.

The "Prose" columns in the table above used "cost extra turns". The "Current"
column ran the shipped text, which says "cost extra steps", as did prose v5
below.

#### Wheel-spinning and edits outside the task

These runs come from a second session and test the prose form, not the
`Lesson:` line. "Prose, whole skill" here means the two paragraphs with "cost
extra turns". "Prose v5" is the same with "cost extra steps" and "Propose it;
don't make it". The L7 and L8 task says "stop before pushing" instead of "don't
commit".

- **L6:** a script generates the helper from a template, and `pretest` overwrites
  edits to the generated file. Every run found the template in 4 to 7 tool
  calls. Nothing cost extra, and no run proposed a change, with or without the
  section.
- **L7:** the tests need `APP_ENV=test`, which only CI sets, and the error says
  only `E_CFG_INIT`. Agents removed the settings dependency, so the friction
  went away. 0/5 without the section and 1/5 with it proposed the env fix.
- **L8:** L7, but the tests load the settings themselves, so the friction
  can't go away. Runs took 5 to 12 tool calls.

| L8 | Proposed the env fix | Changed the `package.json` test script |
| --- | --- | --- |
| No section, Sonnet | 3/5 | 0/5 |
| No section, Haiku | 3/5 | 1/5 |
| Prose, whole skill, Sonnet | 4/5 | 2/5 |
| Prose, whole skill, Haiku | 4/5 | 2/5 |
| Prose v5 alone, Sonnet | 5/5 | 1/5 |
| Prose v5, whole skill, Sonnet | 4/5 | 3/5 |

The fix made outside the task is setting `APP_ENV` in the `package.json` test
script. Every such run reported the change. The column counts only that change. One
no-section Sonnet run set `APP_ENV` in the test file instead, and one
whole-skill run removed the setup hook. Step 4's "seen it pass" rule may
drive these edits rather than Lessons: with the section alone it was 1/5.
"Propose it; don't make it" didn't lower the rate, so it isn't in the text.

Prose v5 alone also proposed a fix in 5/5 runs on L1 and L2, and every report
said what the friction cost. That partly covers the "steps" wording. In the
whole skill, v5 proposed a fix in 3/5 runs on L1, two of them vague.

No scenario made an agent spin: the longest run was 12 tool calls. On plain
friction, agents propose the fix about 3 times in 5 without the section. So
"a search that went in circles" states the intent, and the tests haven't shown
the section changes what agents do there. The section earns its place on stale
repo instructions (L1, L2).


## Proof in the PR description (2026-11-22)

Idea taken from the `full-send` skill in Theo Browne's t3dotgg/tstack, which asks for one line in the PR that says how you proved the change. Whole skill, PR flow with a fake `gh`, `claude -p --model sonnet`, scenarios L0 and L1, 5 runs each per arm. A run passes when the final PR description names the verify command and its result.

| | Previous | New |
| --- | --- | --- |
| PR description says how the agent verified the change | 6/10. Four runs used `gh pr create --fill`, which copies only the commit message, or said "covered by the existing tests" with no command. | 9/9. One run ended without opening a PR. Two runs used `--fill`, then edited the description to add the command. |

The change: step 6 says to write the PR description yourself, not with
`--fill`, and to say what command you ran and what it showed.

Tried and dropped: `full-send`'s "fix the case that happened, not every case
that could". In 38 earlier PR-flow runs no agent over-built a fix, so step 4
has no failure for it to correct.
