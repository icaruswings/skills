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

## Dogfood

The skill and its README entry both run clean through `check-prose.py`.
