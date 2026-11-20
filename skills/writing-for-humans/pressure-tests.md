# Pressure tests

Built with the Superpowers `writing-skills` method: baseline first, then the skill, then close the loopholes. Every number below comes from `check-prose.py` reading the artifact, not from a judgement call.

Seven scenarios, one per human-facing artifact type. Each subagent got a realistic task and no hint about style. The prompts stayed identical between rounds, so the skill had to fire from its own description.

## Round 1, no skill

The control did not fail on AI tells. Across all seven artifacts: zero em dashes, zero curly quotes, zero AI vocabulary, zero title-case headings, zero decorative emoji. The `unslop` skill was already in place and firing, and it did its job.

The control failed on the Simplified Technical English limits every time.

| Artifact | Breaches |
|---|---|
| Design spec | 8 |
| Explainer | 7 |
| Docs section | 4 |
| PR body | 2 |
| Code comment | 2 |
| Commit message | 2 |
| Jira ticket | 1 |

Sentences over 25 words accounted for 12, passive voice for 8, gerund subjects for 6. The worst sentence ran to 40 words.

This decided the skill's content. Pass one delegates to `unslop`, because re-teaching a list that already works buys nothing. Pass two carries the limits.

## Round 2, with the skill

Three artifacts went to zero. Two got worse.

| Artifact | Round 1 | Round 2 |
|---|---|---|
| Docs section | 4 | 0 |
| Code comment | 2 | 0 |
| Explainer | 7 | 0 |
| Commit message | 2 | 0 |
| Design spec | 8 | 1 |
| PR body | 2 | 4 |
| Jira ticket | 1 | 7 |

The three long artifacts each added a line announcing Simplified Technical English, unprompted. That tells us the agents read the skill rather than guessing.

The regressions share one trait. The PR body prompt said "Standup is in 10 minutes". That artifact leaked two em dashes, both as separators between a filename and its note in a bullet list. The agent held the rule inside sentences and decided a list was not a sentence.

That is a discipline failure under time pressure, not a comprehension failure.

## Round 3, after closing the loopholes

Three changes:

- The em dash rule moved out of the limits table into its own section, above it, phrased to cover every character in the artifact. A scoped rule invites an argument about scope.
- An excuse table went in, built from the observed failure. "Standup is in 10 minutes" and "this is a bullet list, not prose" are both answered by name.
- A red flags list went in, so an agent can self-check mid-draft.

Re-tested the two failing scenarios with fresh prompts, five runs total, because single samples lie.

| Run | Breaches |
|---|---|
| PR body, 10 minute deadline | 0 |
| PR body, release train in 15 minutes | 0 |
| PR body, one-line config change | 0 |
| Jira ticket, visit history | 0 |
| Jira ticket, CSV validation | 0 |

Every run put a colon between the filename and its note. No em dashes survived.

## What the checker gets wrong

Four false-positive classes turned up while testing, and three fixes went into the script:

- Adjectival participles such as "is unchanged" read as passive voice. Excluded by a word list.
- A bare list label such as "Provisioning." read as a gerund subject. Excluded when a list item runs to five words or fewer.
- A heading read as a sentence. Headings now skip the passive and gerund checks.
- A quoted counter-example counted against the author. Text inside double quotes and backticks is now ignored.

One false negative stands. A gerund subject followed by an uncommon verb slips through, so "Linking never deletes the credential" reads as clean. The skill says so, and tells the reader to catch that one.

The sentence splitter also needed fixing before any of the numbers meant anything. It would not break before a digit, so it merged two sentences and reported a 22-word sentence as 35 words. Every figure above comes from the corrected script.

## Round 4, after naming the standard

The skill listed seven limits without naming their source, so an agent could hold only the seven written down. The skill now names ASD-STE100, which delegates the rest of the standard the same way pass one delegates to `unslop`.

Re-ran the design spec, the artifact that failed hardest in round 1, on the same prompt.

| Round | Seven limits | Unexpanded acronyms |
|---|---|---|
| 1, no skill | 9 | 10 |
| 2, standard not named | 1 | 5 |
| 4, standard named | 0 | 8 |

The limits reached zero. Acronym handling did not improve, and it moved the wrong way.

Read that as noise, not as a result. Three single samples of one prompt cannot separate a trend from variance. The probe also counted `API`, `HTTP` and `SSO` as breaches, where a gloss would make the prose worse. The acronym rule in this skill is therefore unverified. It says to write out a domain acronym and leave the ones a reader knows cold, which is a judgement call the script cannot score.

The same probe reported up to 11 noun clusters in an artifact the main checker called clean. That detector counts any run of content words, verbs included, so `The client clock decided whether a token was still valid` scores as a cluster. I wrote no rule on the back of it.

## Install consent

Two review lenses read the old pass one wording as a consent fault. It told the agent to install unslop without asking. A user who wanted a PR body then got a network fetch and a write into their home directory. The rule now names the question to ask, in the words the user chose, and it tells the agent to stop and wait. A decline falls through to the same path as a failed install: hold the limits, and say that pass one did not run.

This round changed the wording on request rather than on evidence from a failing arm. The behaviour is unverified. Run an arm that asks for a commit message on a machine without unslop, and check that the agent asks and then waits.

## Dogfood

The skill and its README entry both run clean through `check-prose.py`.

## Round 5: simplification after the unslop update (2026-11-20)

Unslop moved to PStack `2f87c854fe3e`. The new unslop states several rules this skill also stated, so each section had to show a failure without it. The skill went from 151 lines to 38.

Every run used headless Claude Code with Sonnet and all installed skills turned off. Each arm got the skill text in its system prompt. Scores come from `check-prose.py`, and I read the flagged lines by hand. There were eight tasks, with no style hints:

- a PR body with a 10-minute deadline
- a commit message
- a design spec
- a Jira ticket with a 15-minute deadline
- a code comment block
- a README section
- a PR body that lists five files, with a 5-minute deadline
- a chat question

### Does the skill still earn its place?

| Arm | Runs | Breaches | Ran the checker |
|---|---|---|---|
| No skill | 18 | 97 | 0 |
| Unslop only | 18 | 64 | 0 |
| Unslop and the old skill | 18 | 2 | 18 |

The two breaches with the old skill were false positives. A list label, "Engineering", read as a gerund subject.

### What each part is worth

| Part | Test | With it | Without it |
|---|---|---|---|
| The three limits | Design spec | 7 breaches in 16 runs | 19 breaches in 8 runs |
| The dash section | Five-file PR, 5 runs per arm | 0 dashes | 0 dashes, so it was cut |
| "A chat reply gets pass one only" | Chat question, 5 runs per arm | Checker ran 0 times | Checker ran 5 times |

Most of the 7 breaches with the limits were the "Engineering" false positive, and the agent read and kept them.

The dash rule now sits in unslop, rule 13. Without the dash section, every run separated a filename from its note with a colon.

### The report

One version replaced the closing sentences with a fixed report line. It worked on artifacts, but it leaked into 2 to 4 of 5 chat replies until the chat rule named it.

A recount showed that the plain sentences already worked. With unslop missing, the old skill and the first draft told the user in 6 of 6 runs. So the final skill keeps the plain sentences. With them, the agent told the user in 5 of 5 runs and stated the checker result in 6 of 6 artifact runs. It added nothing to 5 of 5 chat replies.

The old install block never ran. With unslop missing, no run asked to install anything. The new skill drops the install, which also removes a stop-and-wait step that a subagent cannot finish.

Instead, the skill names the install command, `npx skills add icaruswings/skills --skill unslop`, and the user decides. With unslop missing, 5 of 5 runs gave the user that command, and none ran it. With unslop present, 0 of 3 runs mentioned it. A trial in an empty project showed that the command installs unslop with its licence.

### Cut without a failing test

These parts had no failure behind them, or the new unslop states them:

- the scope table
- four of the seven limits
- the "keep these" list
- the excuse table and the red flags
- the long-artifact header line
- the evidence link

The excuse table and red flags came in round 3 together with the em dash section. Round 5 found no dash failure without any of them.

### The checker step

The checker passes some breaches. It exempts "is deleted" and "is unchanged", and it missed "Reprovisioning the same subject re-enables the link". The old skill named "is unchanged" as a false positive, which was wrong. So the skill now says to read the draft against the three limits and to review every checker match.

With that wording, 9 artifact runs produced 1 checker match, the "Engineering" false positive. The checker ran in 0 of 3 chat replies, and 2 of 2 runs without unslop told the user. On the design spec, passives that the checker exempts fell from 2 in 3 runs to 1 in 5 runs.

### A real Skill tool call

The test script told the agent to apply unslop from the system prompt. So three more runs used real Claude Code skills instead, renamed `w4hx` and `unslopx` to keep the installed copies out. The PR body task named `w4hx`. In 3 of 3 runs, the agent called `unslopx` through the Skill tool and then ran the checker. All 3 PR bodies were clean. These runs used the checker wording from before the change above, so they test the call to unslop, not that wording.

### Not tested

No run tested when Claude Code loads the skill on its own. Every prompt named the skill, or the system prompt held its text. The description is unchanged.

With unslop missing, all 5 runs told the user that pass one did not run. Only 3 of the 5 also said what the checker found. All 5 drafts were clean.

The last edit cut one sentence that said where unslop ships. None of the 5 runs with unslop missing passed it on to the user.
