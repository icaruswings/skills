# Review quality evaluation

Model-routing smoke tests show which model runs. They do not establish equivalent review quality. Treat lower-cost tiers as a quality/cost policy whose task boundaries need evidence.

The versioned benchmark is in [`evals/mob-review/`](../../evals/mob-review/). It compares tiered reviewers with all-Strong reviewers under identical prompts and review conditions, followed by Strong triage. Each case has executable ground truth; repeated runs measure variability. Raw logs stay local, while normalized results and limitations belong in the PR.

Read the benchmark report before making a quality claim. Human adjudication remains required for disputed or new findings and final acceptance. Curated synthetic cases, even those adapted from historical incidents, establish coverage for their stated contracts rather than general equivalence. Promote a cheaper role/task when it misses a blocker; freeze the candidate before using held-out cases for confirmation.

Run the harness and scoring tests before changing fixtures, routing, prompts, or metrics. Keep the scoring key out of reviewer prompts. Count incomplete runs and unknown models explicitly. Report unique cases separately from repetitions, and measure cost rather than assuming a smaller model makes the whole workflow cheaper.
