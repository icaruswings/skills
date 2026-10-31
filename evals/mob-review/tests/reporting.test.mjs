import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport, renderReport } from '../reporting.mjs';

const fixture = { id: 'C01', split: 'pilot', review: {}, lenses: [{ name: 'Product', tier: 'balanced' }],
  expected: [{ id: 'E01', lens: 'Product', severity: 'blocker', criterion: 'specific defect' }] };
const rows = ['tiered', 'strong'].map(scheme => ({ key: `claude:${scheme}:C01:1`, caseId: 'C01', provider: 'claude', scheme, repetition: 1, split: 'pilot' }));
const finding = { lens: 'Product', severity: 'blocker', title: 'defect', evidence: 'specific evidence', location: 'module.js:1' };
const panels = rows.map((row, i) => ({ ...row, id: `p${i}`, status: 'complete', modelVerified: true,
  reports: [{ lens: 'Product', findings: [structuredClone(finding)], gaps: [] }], triage: { findings: [structuredClone(finding)], gaps: [] } }));
const judgments = panels.map(panel => ({ panelId: panel.id, raw: [{ expectedId: 'E01', findingIndex: 0 }], triage: [{ expectedId: 'E01', findingIndex: 0 }], notes: [] }));
const call = (key, costUsd, status = 'complete') => ({ id: key, key, provider: 'claude', status, costUsd, elapsedMs: 1000,
  requestedModel: 'opus', effectiveModel: 'claude-opus-test', modelVerified: true, effortVerified: true, tokens: { input: 100, cached: 20, output: 10 } });
const options = { manifest: { matrix: rows, inputHash: 'frozen', repetitions: 1, claudeCapUsd: 20 }, fixtures: [fixture], panels, judgments,
  runCalls: [call(`${rows[0].key}:Product`, .05), call(`${rows[0].key}:triage`, .05),
    call(`${rows[1].key}:Product`, .1), call(`${rows[1].key}:triage`, .1)], gradingCalls: [], campaignCalls: [], sourceCommit: 'abc' };

test('a perfect machine score still withholds human signoff and general quality equivalence', () => {
  const report = buildReport(options);
  assert.equal(report.gates.allObservationsComplete, true);
  assert.equal(report.gates.everyKnownBlockerDetectedAndRetained, true);
  assert.equal(report.gates.zeroAddedMissedBlockers, true);
  assert.equal(report.gates.humanSignoff, false);
  assert.equal(report.gates.qualityEquivalent, false);
  assert.equal(report.coverage.uniqueCases, 1);
  assert.equal(report.coverage.panels, 2);
  assert.equal(report.coverage.cheaperMappingCases, 1);
  assert.match(renderReport(report), /human/i);
});

test('a missing baseline or missing judgment cannot be reported as a passing comparison', () => {
  const report = buildReport({ ...options, panels: panels.slice(0, 1), judgments: [] });
  assert.equal(report.scores.length, 2);
  assert.equal(report.gates.allObservationsComplete, false);
  assert.equal(report.gates.zeroAddedMissedBlockers, false);
  assert.equal(report.groups.find(row => row.scheme === 'strong').incompleteObservations, 1);
  assert.equal(report.costComparisons[0].claudeSavingsFraction, null);
  assert.equal(report.costComparisons[0].aggregateProcessSavingsFraction, null);
});

test('a separate paid attempt with identical inputs remains campaign overhead', () => {
  const original = { ...options.runCalls[0], identity: 'same-inputs', startedAt: '2026-10-29T00:00:00Z' };
  const repeated = { ...original, startedAt: '2026-10-29T01:00:00Z' };
  const runCalls = [repeated, ...options.runCalls.slice(1)];
  const report = buildReport({ ...options, runCalls, campaignCalls: [original, ...runCalls] });
  assert.equal(report.resources.overhead.claude.knownCostUsd, .05);
});

test('missing stage records or time measurements withhold matched savings', () => {
  const partial = buildReport({ ...options, runCalls: options.runCalls.slice(1) });
  assert.equal(partial.costComparisons[0].claudeSavingsFraction, null);
  const missingTime = structuredClone(options.runCalls);
  delete missingTime[0].elapsedMs;
  assert.equal(buildReport({ ...options, runCalls: missingTime }).costComparisons[0].aggregateProcessSavingsFraction, null);
});

test('failed attempts affect measured arm costs and overhead stays outside arm comparisons', () => {
  const runCalls = [...options.runCalls, call(`${rows[0].key}:Product:retry1`, .04, 'error')];
  const overhead = call('smoke:old', .3, 'error');
  const report = buildReport({ ...options, runCalls, campaignCalls: [...runCalls, overhead] });
  assert.ok(Math.abs(report.groups.find(row => row.scheme === 'tiered').resources.knownCostUsd - .14) < 1e-9);
  assert.ok(Math.abs(report.resources.campaign.claude.knownCostUsd - .64) < 1e-9);
  assert.ok(Math.abs(report.resources.overhead.claude.knownCostUsd - .3) < 1e-9);
  assert.ok(Math.abs(report.costComparisons[0].claudeSavingsFraction - .3) < 1e-9);
});

test('the machine blocker gate counts a severity downgrade even when semantic recall is perfect', () => {
  const changed = structuredClone(panels);
  changed[0].triage.findings[0].severity = 'should-fix';
  const report = buildReport({ ...options, panels: changed });
  assert.equal(report.gates.everyKnownBlockerDetectedAndRetained, false);
  assert.equal(report.gates.zeroAddedMissedBlockers, false);
  assert.equal(report.groups.find(row => row.scheme === 'tiered').knownDefectRecall, 1);
  assert.equal(report.scores[0].finalMissedBlockerIds.length, 1);
});
