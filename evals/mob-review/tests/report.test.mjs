import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeMatrix, resourceTotals, humanQueue } from '../report-data.mjs';
import { opaqueId } from '../runner-state.mjs';

const fixtures = [{ id: 'C01', expected: [{ id: 'E' }] }];

test('unattempted comparison arms are explicitly incomplete rather than silently disappearing', () => {
  const matrix = [{ key: 'codex:tiered:C01:1', caseId: 'C01', provider: 'codex', scheme: 'tiered', repetition: 1 },
    { key: 'codex:strong:C01:1', caseId: 'C01', provider: 'codex', scheme: 'strong', repetition: 1 }];
  const panels = completeMatrix(matrix, [{ ...matrix[0], id: 'a', status: 'complete' }]);
  assert.equal(panels.length, 2);
  assert.equal(panels[1].status, 'error');
  assert.match(panels[1].error, /not attempted/i);
});

test('resource totals include failed attempts and distinguish unknown cost/usage', () => {
  const calls = [{ status: 'error', costUsd: .1, elapsedMs: 10, tokens: { input: 5, output: 2, cached: 0 } },
    { status: 'complete', costUsd: .2, elapsedMs: 20, tokens: { input: 8, output: 4, cached: 3 } }];
  const totals = resourceTotals(calls);
  assert.ok(Math.abs(totals.knownCostUsd - .3) < 1e-9);
  assert.equal(totals.inputTokens, 13);
  assert.equal(totals.failedCalls, 1);
  const unknown = resourceTotals([...calls, { status: 'started', costUsd: null }]);
  assert.equal(unknown.unknownCostCalls, 1);
  assert.equal(unknown.unknownTokenCalls, 1);
});

test('the human queue remains blinded and does not call unmatched claims false positives', () => {
  const panel = { id: 'opaque', caseId: 'C01', provider: 'SECRET', reports: [{ findings: [{ lens: 'Product', title: 'new claim', severity: 'optional', evidence: 'e', location: 'x' }] }], triage: { findings: [] } };
  const queue = humanQueue([panel], [{ panelId: 'opaque', raw: [], triage: [] }], fixtures);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'human-pending');
  assert.ok(!JSON.stringify(queue).includes('SECRET'));
});

test('matrix completion preserves planned order and metadata and rejects repeated or foreign keys', () => {
  const matrix = [{ key: 'first', caseId: 'C01', split: 'pilot' }, { key: 'second', caseId: 'C02' }];
  const result = completeMatrix(matrix, [{ key: 'second', id: 'existing', status: 'complete', caseId: 'wrong' }]);
  assert.deepEqual(result[0], { ...matrix[0], id: opaqueId('first'), status: 'error', error: 'Not attempted', modelVerified: false, reports: [] });
  assert.deepEqual(result[1], { ...matrix[1], id: 'existing', status: 'complete' });
  assert.throws(() => completeMatrix([...matrix, matrix[0]], []), /duplicate/i);
  assert.throws(() => completeMatrix(matrix, [{ key: 'second' }, { key: 'second' }]), /duplicate/i);
  assert.throws(() => completeMatrix(matrix, [{ key: 'foreign' }]), /foreign/i);
  assert.throws(() => completeMatrix(null, []), /array/i);
});

test('resource totals count partial observations as unknown while retaining measured lower bounds', () => {
  assert.deepEqual(resourceTotals([
    { status: 'complete', costUsd: 0, elapsedMs: 1500, tokens: { input: 10, cached: 4, output: 2 } },
    { status: 'error', costUsd: null, elapsedMs: 250, tokens: { input: 3, cached: null, output: NaN } },
    { status: 'started', costUsd: Infinity },
  ]), { calls: 3, failedCalls: 2, knownCostUsd: 0, unknownCostCalls: 2,
    inputTokens: 13, cachedTokens: 4, outputTokens: 2, unknownTokenCalls: 2, processSeconds: 1.75 });
  assert.throws(() => resourceTotals([null]), /invalid call/i);
});

test('queue uses flattened raw indices and separate final indices with only matching judgments', () => {
  const findings = [{ title: 'a' }, { title: 'b' }, { title: 'c' }];
  const panel = { id: 'p', caseId: 'C01', model: 'secret', scheme: 'secret', repetition: 7,
    reports: [{ findings: findings.slice(0, 1) }, { findings: findings.slice(1) }], triage: { findings: [findings[2]] } };
  const judgments = [{ panelId: 'another', raw: [{ expectedId: 'E', findingIndex: 0 }], triage: [] },
    { panelId: 'p', raw: [{ expectedId: 'E', findingIndex: 1 }], triage: [{ expectedId: 'E', findingIndex: 9 }] }];
  assert.deepEqual(humanQueue([panel], judgments, fixtures), [
    { panelId: 'p', caseId: 'C01', stage: 'raw', findingIndex: 0, finding: findings[0], status: 'human-pending' },
    { panelId: 'p', caseId: 'C01', stage: 'raw', findingIndex: 2, finding: findings[2], status: 'human-pending' },
    { panelId: 'p', caseId: 'C01', stage: 'triage', findingIndex: 0, finding: findings[2], status: 'human-pending' },
  ]);
  assert.throws(() => humanQueue([panel], [judgments[1], judgments[1]], fixtures), /duplicate/i);
  assert.throws(() => humanQueue([{ id: 'p', caseId: 'C01', reports: [{ findings: null }] }], [], fixtures), /array/i);
});


test('unknown expected IDs and clean-case claims remain in the human queue', () => {
  const panel = { id: 'p', caseId: 'C01', reports: [{ findings: [{ title: 'claim' }] }] };
  const match = expectedId => [{ panelId: 'p', raw: [{ expectedId, findingIndex: 0 }], triage: [] }];
  assert.equal(humanQueue([panel], match('unknown'), fixtures).length, 1);
  assert.equal(humanQueue([panel], match('E'), [{ id: 'C01', expected: [] }]).length, 1);
  assert.equal(humanQueue([panel], match('E'), fixtures).length, 0);
  assert.throws(() => humanQueue([panel], [], []), /unknown panel case/i);
});
