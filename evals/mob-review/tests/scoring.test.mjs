import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as scoring from '../scoring.mjs';
const { scorePanel } = scoring;

const fixture = {
  id: 'C01', split: 'pilot',
  expected: [
    { id: 'E1', severity: 'blocker', lens: 'Security', criterion: 'reject access' },
    { id: 'E2', severity: 'suggestion', lens: 'Product', criterion: 'clarify label' },
  ],
};
const finding = (severity = 'blocker', lens = 'Security') => ({
  severity, lens, title: 'Finding', evidence: 'Concrete evidence', location: 'after:1',
});
const panel = (overrides = {}) => ({
  id: 'P1', caseId: 'C01', provider: 'codex', scheme: 'tiered', repetition: 1,
  status: 'complete', modelVerified: true,
  reports: [{ lens: 'Security', findings: [finding()], gaps: [] }],
  triage: { findings: [finding()], gaps: [] },
  ...overrides,
});
const judgment = (overrides = {}) => ({
  panelId: 'P1', raw: [{ expectedId: 'E1', findingIndex: 0 }],
  triage: [{ expectedId: 'E1', findingIndex: 0 }], ...overrides,
});

test('counts matched defects once while attributing detection to the actual review lens', () => {
  const input = panel({
    reports: [{ lens: 'Staff', findings: [finding('blocker', 'Staff'), finding('blocker', 'Staff')], gaps: [] }],
  });
  const score = scorePanel(fixture, input, judgment({ raw: [
    { expectedId: 'E1', findingIndex: 0 }, { expectedId: 'E1', findingIndex: 1 },
    { expectedId: 'E1', findingIndex: 1 },
  ] }));
  assert.equal(score.complete, true);
  assert.deepEqual(score.detectedIds, ['E1']);
  assert.deepEqual(score.retainedIds, ['E1']);
  assert.deepEqual(score.missedIds, ['E2']);
  assert.deepEqual(score.missedBlockerIds, []);
  assert.equal(score.unmatchedRaw, 0);
  assert.deepEqual(score.perLens.find(row => row.lens === 'Staff'), {
    lens: 'Staff', expectedIds: [], detectedIds: ['E1'], retainedIds: [],
  });
  assert.deepEqual(score.perLens.find(row => row.lens === 'Security').detectedIds, []);
});

test('rejects unknown expected IDs and invalid indices without awarding recall', () => {
  const score = scorePanel(fixture, panel(), judgment({ raw: [
    { expectedId: 'unknown', findingIndex: 0 }, { expectedId: 'E1', findingIndex: -1 },
    { expectedId: 'E1', findingIndex: 1 }, { expectedId: 'E1', findingIndex: 0.5 },
    { expectedId: 'E1', findingIndex: '0' },
  ], triage: [] }));
  assert.deepEqual(score.detectedIds, []);
  assert.deepEqual(score.retainedIds, []);
  assert.equal(score.unmatchedRaw, 1);
  assert.equal(score.unmatchedFinal, 1);
  assert.equal(score.invalidMatches.length, 5);
  assert.equal(score.complete, false);
});

test('tracks blocker severity downgrades and losses during triage separately', () => {
  const downgraded = scorePanel(fixture, panel({ triage: { findings: [finding('suggestion')], gaps: [] } }), judgment());
  assert.deepEqual(downgraded.retainedIds, ['E1']);
  assert.deepEqual(downgraded.missedBlockerIds, ['E1']);
  assert.deepEqual(downgraded.triageLostIds, []);
  assert.deepEqual(downgraded.severityMismatches, [{
    stage: 'triage', expectedId: 'E1', findingIndex: 0, expected: 'blocker', actual: 'suggestion',
  }]);
  const lost = scorePanel(fixture, panel({ triage: { findings: [], gaps: [] } }), judgment({ triage: [] }));
  assert.deepEqual(lost.triageLostIds, ['E1']);
  assert.deepEqual(lost.missedBlockerIds, ['E1']);
  const rawDowngrade = scorePanel(fixture, panel({ reports: [{ lens: 'Security', findings: [finding('suggestion')], gaps: [] }] }), judgment());
  assert.deepEqual(rawDowngrade.missedBlockerIds, ['E1']);
});

test('keeps clean-case alarms pending human adjudication rather than calling them false positives', () => {
  const score = scorePanel({ ...fixture, expected: [] }, panel(), judgment({ raw: [], triage: [] }));
  assert.deepEqual(score.missedIds, []);
  assert.equal(score.unmatchedRaw, 1);
  assert.equal(score.unmatchedFinal, 1);
  assert.equal(score.cleanCaseAlarms, 1);
  assert.equal(score.adjudicationStatus, 'human-pending');
  assert.equal('falsePositives' in score, false);
});

test('errors, unverified models, missing triage and missing judgments are explicitly incomplete', () => {
  for (const input of [panel({ status: 'error' }), panel({ modelVerified: false }), panel({ triage: null })]) {
    const score = scorePanel(fixture, input, judgment());
    assert.equal(score.complete, false);
    assert.ok(score.incompleteReasons.length > 0);
  }
  assert.equal(scorePanel(fixture, panel(), null).complete, false);
  assert.equal(scorePanel(fixture, panel(), judgment({ panelId: 'other' })).complete, false);
});

test('raw match indices address findings flattened in report order', () => {
  const input = panel({ reports: [
    { lens: 'Product', findings: [finding('suggestion', 'Product')], gaps: [] },
    { lens: 'Security', findings: [finding()], gaps: [] },
  ] });
  const score = scorePanel(fixture, input, judgment({ raw: [
    { expectedId: 'E2', findingIndex: 0 }, { expectedId: 'E1', findingIndex: 1 },
  ] }));
  assert.deepEqual(score.detectedIds, ['E2', 'E1']);
  assert.deepEqual(score.missedBlockerIds, []);
  assert.deepEqual(score.triageLostIds, ['E2']);
  assert.equal(score.unmatchedRaw, 0);
});

test('malformed judgment collections are incomplete rather than crashing or matching', () => {
  const score = scorePanel(fixture, panel(), judgment({ raw: {}, triage: 'invalid' }));
  assert.equal(score.complete, false);
  assert.deepEqual(score.detectedIds, []);
  assert.deepEqual(score.retainedIds, []);
  assert.equal(score.unmatchedFinal, 1);
});

test('summaries separate case coverage from repeated observations and never assert equivalence', () => {
  const onlyBlocker = { ...fixture, expected: [fixture.expected[0]] };
  const first = scorePanel(onlyBlocker, panel(), judgment());
  const repeated = scorePanel(onlyBlocker, panel({ id: 'P2', repetition: 2 }), judgment({ panelId: 'P2' }));
  const strong = scorePanel(onlyBlocker, panel({ id: 'P3', scheme: 'strong' }), judgment({ panelId: 'P3' }));
  const groups = scoring.summarize([first, repeated, strong]);
  assert.equal(groups.length, 2);
  const tiered = groups.find(row => row.scheme === 'tiered');
  assert.equal(tiered.uniqueCases, 1);
  assert.equal(tiered.observations, 2);
  assert.equal(tiered.knownDefects, 2);
  assert.equal(tiered.knownBlockers, 2);
  assert.equal(tiered.missedBlockers, 0);
  assert.equal(tiered.knownDefectRecall, 1);
  assert.equal(tiered.machineGatePassed, true);
  assert.equal(tiered.qualityEquivalent, false);
  assert.equal(tiered.humanSignoff, false);
  assert.deepEqual(scoring.summarize([]), []);
});

test('summary gate withholds success for incompleteness, blocker misses and unresolved alarms', () => {
  const missing = scorePanel(fixture, panel({ triage: { findings: [], gaps: [] } }), judgment({ triage: [] }));
  const alarm = scorePanel({ ...fixture, expected: [] }, panel({ id: 'P2' }), judgment({ panelId: 'P2', raw: [], triage: [] }));
  const failed = scorePanel(fixture, panel({ id: 'P3', status: 'error' }), null);
  const [summary] = scoring.summarize([missing, alarm, failed]);
  assert.equal(summary.machineGatePassed, false);
  assert.equal(summary.qualityEquivalent, false);
  assert.equal(summary.incompleteObservations, 1);
  assert.equal(summary.triageLosses, 1);
  assert.equal(summary.missedBlockers, 2);
  assert.equal(summary.unmatchedRaw, 2);
  assert.equal(summary.unmatchedFinal, 2);
  assert.equal(summary.cleanCaseAlarms, 1);
  assert.equal(summary.uniqueKnownDefects, 2);
  assert.equal(summary.uniqueKnownBlockers, 1);
});

test('pairs compare blocker misses within the same provider, case and repetition', () => {
  const entry = (panelId, provider, scheme, repetition, missedBlockerIds) => ({
    panelId, provider, scheme, repetition, caseId: 'C01', complete: true, missedBlockerIds,
  });
  const pairs = scoring.comparePairs([
    entry('t1', 'codex', 'tiered', 1, ['E1']), entry('s1', 'codex', 'strong', 1, ['E2']),
    entry('t2', 'codex', 'tiered', 2, []), entry('s2', 'codex', 'strong', 2, []),
    entry('ct1', 'claude', 'tiered', 1, []), entry('cs1', 'claude', 'strong', 1, []),
  ]);
  assert.equal(pairs.length, 3);
  const codex = pairs.find(row => row.provider === 'codex' && row.repetition === 1);
  assert.deepEqual(codex.addedMissedBlockerIds, ['E1']);
  assert.deepEqual(codex.baselineOnlyMissedBlockerIds, ['E2']);
  assert.equal(codex.complete, true);
  assert.equal(codex.zeroAddedMissedBlockers, false);
  assert.equal(pairs.find(row => row.provider === 'claude').zeroAddedMissedBlockers, true);
});

test('missing, duplicate and incomplete comparison arms cannot satisfy the paired gate', () => {
  const base = scorePanel(fixture, panel(), judgment());
  for (const scores of [
    [base],
    [base, { ...base, panelId: 'P2', scheme: 'strong', complete: false }],
    [base, { ...base, panelId: 'P2' }, { ...base, panelId: 'P3', scheme: 'strong' }],
  ]) {
    const [pair] = scoring.comparePairs(scores);
    assert.equal(pair.complete, false);
    assert.equal(pair.zeroAddedMissedBlockers, null);
    assert.equal(pair.addedMissedBlockerIds, null);
  }
});
