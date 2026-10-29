import { scorePanel, summarize, comparePairs } from './scoring.mjs';
import { completeMatrix, resourceTotals, humanQueue } from './report-data.mjs';

const count = (rows, field) => rows.reduce((sum, row) => sum + row[field].length, 0);
const byProvider = calls => Object.fromEntries(['claude', 'codex'].map(provider =>
  [provider, resourceTotals(calls.filter(call => call.provider === provider))]));
// Same inputs in another physical run can incur another charge.
export const attemptIdentity = call => JSON.stringify([call.provider, call.id, call.identity ?? null, call.startedAt ?? null]);

function observations(manifest, panels, judgments, fixtures) {
  const complete = completeMatrix(manifest.matrix, panels);
  const known = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  const matching = new Map();
  for (const judgment of judgments) {
    if (matching.has(judgment.panelId)) throw new Error(`Duplicate judgment ${judgment.panelId}`);
    matching.set(judgment.panelId, judgment);
  }
  const scores = complete.map(panel => {
    const fixture = known.get(panel.caseId);
    if (!fixture) throw new Error(`Unknown case ${panel.caseId}`);
    return scorePanel(fixture, panel, matching.get(panel.id));
  });
  return { panels: complete, scores };
}

function groupResources(group, matrix, calls, fixtures) {
  const rows = matrix.filter(row => row.provider === group.provider && row.scheme === group.scheme);
  const selected = calls.filter(call => rows.some(row => call.key.startsWith(`${row.key}:`)));
  const stages = rows.flatMap(row => [...fixtures.find(fixture => fixture.id === row.caseId).lenses.map(lens => lens.name), 'triage']
    .map(lens => `${row.key}:${lens}`));
  const missingCompletedStages = stages.filter(stage => !selected.some(call => (call.key === stage || call.key.startsWith(`${stage}:retry`))
    && call.status === 'complete' && call.modelVerified === true && call.effortVerified === true)).length;
  return { ...resourceTotals(selected), missingCompletedStages,
    unknownTimeCalls: selected.filter(call => !Number.isFinite(call.elapsedMs) || call.elapsedMs < 0).length };
}

function roleResources(matrix, calls) {
  const groups = new Map();
  for (const call of calls) {
    const row = matrix.find(row => call.key.startsWith(`${row.key}:`));
    if (!row) throw new Error(`Call outside planned matrix: ${call.key}`);
    const lens = call.key.slice(row.key.length + 1).split(':')[0];
    const key = JSON.stringify([row.provider, row.scheme, lens]);
    if (!groups.has(key)) groups.set(key, { provider: row.provider, scheme: row.scheme, lens, calls: [] });
    groups.get(key).calls.push(call);
  }
  return [...groups.values()].map(({ calls: selected, ...group }) => ({ ...group, resources: resourceTotals(selected) }));
}

function coverage(matrix, fixtures) {
  const ids = new Set(matrix.map(row => row.caseId));
  const selected = fixtures.filter(fixture => ids.has(fixture.id));
  const identicalMappingCases = selected.filter(fixture => fixture.lenses.every(lens => lens.tier === 'strong')).length;
  return { panels: matrix.length, uniqueCases: selected.length,
    defectCases: selected.filter(fixture => fixture.expected.length).length,
    cleanCases: selected.filter(fixture => !fixture.expected.length).length,
    knownDefects: selected.reduce((sum, fixture) => sum + fixture.expected.length, 0),
    knownBlockers: selected.reduce((sum, fixture) => sum + fixture.expected.filter(item => item.severity === 'blocker').length, 0),
    identicalMappingCases, cheaperMappingCases: selected.length - identicalMappingCases,
    pilot: selected.filter(fixture => fixture.split === 'pilot').map(fixture => fixture.id),
    holdout: selected.filter(fixture => fixture.split === 'holdout').map(fixture => fixture.id) };
}

function costComparisons(groups) {
  return [...new Set(groups.map(group => group.provider))].map(provider => {
    const tieredGroup = groups.find(group => group.provider === provider && group.scheme === 'tiered');
    const strongGroup = groups.find(group => group.provider === provider && group.scheme === 'strong');
    const tiered = tieredGroup?.resources, strong = strongGroup?.resources;
    const complete = [tieredGroup, strongGroup].every(group => group && group.observations > 0 && group.completeObservations === group.observations
      && group.resources.missingCompletedStages === 0);
    const known = complete && provider === 'claude' && tiered && strong && tiered.unknownCostCalls === 0 && strong.unknownCostCalls === 0 && strong.knownCostUsd > 0;
    return { provider, claudeSavingsFraction: known ? 1 - tiered.knownCostUsd / strong.knownCostUsd : null,
      aggregateProcessSavingsFraction: complete && tiered.unknownTimeCalls === 0 && strong.unknownTimeCalls === 0 && strong?.processSeconds > 0
        ? 1 - tiered.processSeconds / strong.processSeconds : null };
  });
}

export function buildReport({ manifest, fixtures, panels, judgments, runCalls, gradingCalls = [], campaignCalls = [], sourceCommit }) {
  const measured = observations(manifest, panels, judgments, fixtures);
  const scores = measured.scores, pairs = comparePairs(scores);
  const groups = summarize(scores).map(group => ({ ...group, resources: groupResources(group, manifest.matrix, runCalls, fixtures),
    rawMissedBlockers: count(scores.filter(score => score.provider === group.provider && score.scheme === group.scheme), 'rawMissedBlockerIds'),
    finalMissedBlockers: count(scores.filter(score => score.provider === group.provider && score.scheme === group.scheme), 'finalMissedBlockerIds') }));
  const comparisonIds = new Set([...runCalls, ...gradingCalls].map(attemptIdentity));
  const allComplete = scores.length > 0 && scores.every(score => score.complete);
  const queue = humanQueue(measured.panels, judgments, fixtures);
  return {
    schemaVersion: 1, sourceCommit, startedAt: manifest.createdAt ?? null, inputHash: manifest.inputHash, repetitions: manifest.repetitions,
    coverage: coverage(manifest.matrix, fixtures),
    adjudication: 'blinded-machine-provisional',
    gates: { allObservationsComplete: allComplete,
      everyKnownBlockerDetectedAndRetained: allComplete && scores.every(score => score.missedBlockerIds.length === 0),
      zeroAddedMissedBlockers: pairs.length > 0 && pairs.every(pair => pair.zeroAddedMissedBlockers === true),
      unmatchedClaimsResolved: queue.length === 0, humanSignoff: false, qualityEquivalent: false },
    groups, splits: ['pilot', 'holdout'].flatMap(split => summarize(scores.filter(score => score.split === split)).map(group => ({ split, ...group }))),
    pairs, scores, humanQueue: queue,
    resources: { comparison: byProvider(runCalls), grading: byProvider(gradingCalls), campaign: byProvider(campaignCalls),
      overhead: byProvider(campaignCalls.filter(call => !comparisonIds.has(attemptIdentity(call)))),
      byRole: roleResources(manifest.matrix, runCalls), claudeCapUsd: manifest.claudeCapUsd },
    observedModels: [...new Map(runCalls.map(call => {
      const entry = { provider: call.provider, requestedModel: call.requestedModel, requestedEffort: call.requestedEffort ?? null,
        effectiveModel: call.effectiveModel ?? null, effectiveEffort: call.effectiveEffort ?? null,
        modelVerified: call.modelVerified === true, effortVerified: call.effortVerified === true };
      return [JSON.stringify(entry), entry];
    })).values()],
    costComparisons: costComparisons(groups),
  };
}

const money = value => `$${value.toFixed(4)}`;
const percent = value => value == null ? 'pending' : `${(100 * value).toFixed(1)}%`;
const check = value => value ? 'pass (provisional)' : 'not passed';
const arm = value => value === 'strong' ? 'all Strong' : 'tiered';

function qualityTable(groups, split = false) {
  const rows = groups.map(group => `| ${split ? `${group.split} | ` : ''}${group.provider} | ${arm(group.scheme)} | ${group.completeObservations}/${group.observations} | ${group.retainedDefects}/${group.knownDefects} | ${group.rawMissedBlockers ?? 'see JSON'} | ${group.finalMissedBlockers ?? 'see JSON'} | ${group.triageLosses} | ${group.unmatchedFinal} | ${group.cleanCaseAlarms} |`);
  return [`| ${split ? 'Split | ' : ''}Provider | Policy | Completed / planned | Known defects retained | Raw blocker misses / downgrades | Final blocker misses / downgrades | Triage losses | Unmatched final claims | Clean-case alarms |`,
    `| ${split ? '--- | ' : ''}--- | --- | --- | --- | --- | --- | --- | --- | --- |`, ...rows].join('\n');
}

export function renderReport(report) {
  const { coverage: c, gates: g, resources: r } = report;
  const added = report.pairs.filter(pair => pair.addedMissedBlockerIds?.length);
  const misses = report.scores.filter(score => score.missedBlockerIds.length || !score.complete);
  const lines = [
    `# Mob-review quality pilot, ${report.startedAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(report.startedAt)) + ' UTC' : 'date unavailable'}`, '',
    'This report follows Simplified Technical English.', '',
    '**These are provisional machine-graded results. Human adjudication and final approval remain pending. This pilot does not establish equivalent review quality.**', '',
    `The frozen evaluation used source commit \`${report.sourceCommit}\` and input hash \`${report.inputHash}\`. It contains ${c.uniqueCases} unique cases. ${c.defectCases} cases contain ${c.knownDefects} known defects, including ${c.knownBlockers} labeled blockers. The remaining ${c.cleanCases} cases are clean controls. Each provider/policy has ${report.repetitions} repetitions, with ${c.panels} planned panels in total.`, '',
    ...(report.gradingSourceCommit ? [`The grader used source commit \`${report.gradingSourceCommit}\`. The manifest records its source/runtime hash.`, ''] : []),
    `There are ${c.pilot.length} pilot cases and ${c.holdout.length} held-out cases. ${c.cheaperMappingCases} cases exercise a cheaper model. ${c.identicalMappingCases} cases assign every reviewer Strong in both arms. Repetitions produce correlated observations, not additional independent defects.`, '',
    '## Quality results', '', qualityTable(report.groups), '',
    'Known-defect retention counts semantic matches at final triage. A blocker miss/downgrade means the reviewer or triage omitted a known blocker or assigned it a lower severity. The blocker gate requires detection at the reviewer stage and retention as a blocker at triage. Unmatched claims await human review. They are not automatically false positives. Clean-case alarms count final findings on controls, including optional advice.', '',
    `- All planned observations complete and model-verified: **${check(g.allObservationsComplete)}**.`,
    `- Every known blocker detected and retained as a blocker: **${check(g.everyKnownBlockerDetectedAndRetained)}**.`,
    `- Zero additional missed/downgraded blockers versus the paired all-Strong baseline: **${check(g.zeroAddedMissedBlockers)}** (${added.length} pairs with additional misses).`,
    `- Unmatched claims resolved: **${check(g.unmatchedClaimsResolved)}** (${report.humanQueue.length} raw/final claims queued).`,
    '- Human sign-off: **pending**. General quality equivalence: **not established**.', '',
    '## Cost and time', '',
    '| Provider | Policy | Calls (failed) | Observed Claude cost | Input tokens (cached subset) | Output tokens | Aggregate process seconds |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.groups.map(group => { const t = group.resources; return `| ${group.provider} | ${arm(group.scheme)} | ${t.calls} (${t.failedCalls}) | ${group.provider === 'claude' ? money(t.knownCostUsd) : 'not reported'} | ${t.inputTokens} (${t.cachedTokens}) | ${t.outputTokens} | ${t.processSeconds.toFixed(1)} |`; }), '',
    ...report.costComparisons.map(row => `${row.provider}: measured Claude cost savings ${row.provider === 'claude' ? percent(row.claudeSavingsFraction) : 'not priced'}. Aggregate process-time savings ${percent(row.aggregateProcessSavingsFraction)}.`), '',
    `Claude campaign spending is **${money(r.campaign.claude.knownCostUsd)} of the US$${r.claudeCapUsd.toFixed(2)} cap**. This includes ${money(r.overhead.claude.knownCostUsd)} for discarded/smoke attempts. Unknown Claude cost records: ${r.campaign.claude.unknownCostCalls}. Comparison rows include failed attempts associated with each arm. Arm savings exclude overhead.`, '',
    `Captured Codex CLI usage includes comparison, grading, and overhead. It totals ${r.campaign.codex.inputTokens} input tokens, including ${r.campaign.codex.cachedTokens} cached tokens, and ${r.campaign.codex.outputTokens} output tokens. ${r.campaign.codex.unknownTokenCalls} calls have incomplete usage. Captured totals are lower bounds. These CLI totals exclude authoring/chat/app usage. This report infers no dollar conversion.`, '',
    'Process seconds sum subprocess durations, including startup and retries. They do not measure wall-clock time or estimate user-facing native subagent latency. Calls ran concurrently. Cached input is a subset of input tokens. Output includes provider-reported reasoning where applicable.', '',
    '## Paired exceptions', '',
    ...(added.length ? added.map(pair => `- ${pair.provider} ${pair.caseId}, repetition ${pair.repetition}: added blocker misses/downgrades ${pair.addedMissedBlockerIds.join(', ')}.`) : ['No added blocker misses in completed paired observations; see completeness gate above.']), '',
    '## Cases requiring blocker/severity review', '',
    ...(misses.length ? misses.map(score => `- ${score.provider} ${arm(score.scheme)} ${score.caseId}, repetition ${score.repetition}: raw ${score.rawMissedBlockerIds.join(', ') || 'none'}; final ${score.finalMissedBlockerIds.join(', ') || 'none'}${score.complete ? '' : `; incomplete (${score.incompleteReasons.join(', ')})`}.`) : ['No known blocker misses or downgrades in machine matches.']), '',
    '## Evidence and limits', '',
    '- This report includes [summary and per-observation scores](summary.json), [normalized reviews](reviews.json), and [blinded judgments](judgments.json). It also includes the [human claim queue](human-queue.json), [executable oracle evidence](oracles.json), [manifest](manifest.json), and [normalized call usage](calls.json). These public evidence files reveal the model mapping. Give human adjudicators only the [blinded review packet](blinded-review.json) before they inspect these files.',
    '- `human-review.json` lists truth-label sign-off, severity disputes, triage losses, and unmatched claims. Its pending state is deliberate. Machine matching concealed provider, arm, model, and repetition. It was not a human blind review. The independent grader used Codex Astra/high, which may share model-specific biases with the Codex baseline.',
    '- Fixtures are short, self-contained JavaScript contracts. UI, filesystem, YAML, and provider behaviors are simulations. Five cases adapt two related repository repair commits, so they are not five independent historical incidents. Ground-truth probes and independent code review support the labels. Human label approval remains pending.',
    '- Review roles ran in separate tool-free CLI processes. Strong CLI triage followed. This measures inference on supplied context. Separate tests checked actual Claude/Codex subagent launches. The pilot does not establish full-repository review, architecture discovery, tool use, or native fan-out performance.',
    '- Codex CLI Balanced used `gpt-6-sol/medium`. This CLI/auth context rejected the app-supported `gpt-6.1-sol`. This does not evaluate the app Balanced model. Call records show requested and runtime-resolved models/efforts. Client metadata cannot prove undisclosed backend routing.',
    '- The evaluation froze the candidate, prompts, cases, splits, schemas, and model configuration before the completed matrix. The evaluation did not use held-out answers to tune them. A new run on these cases after a policy change would test for regressions. It would not provide fresh held-out confirmation.',
    ...(report.verificationSmoke ? [`- A separate [live smoke check](final-smoke.json) verified ${report.verificationSmoke.panels} panels and ${report.verificationSmoke.calls} calls after implementation review. It used source commit \`${report.verificationSmoke.sourceCommit}\`. This smoke check tests orchestration and does not provide fresh held-out quality confirmation.`] : []),
    '- Keep the PR draft until humans adjudicate claims and severity labels, review blocker exceptions, and approve acceptance. Promote bounded tasks that miss real blockers. Then evaluate the changed policy on new held-out cases. Do not infer general parity from an aggregate score.', '',
    '## Split and role detail', '',
    '`summary.json` contains detailed per-split summaries, per-lens attribution, paired deltas, and per-role resource totals. A lens can discover a defect labeled for another lens. Per-lens detections therefore do not share a common recall denominator.', '',
  ];
  return lines.join('\n');
}
