import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blindPayload, parseJudgments } from '../grading.mjs';

test('grading payload removes model, provider, arm and repetition identity', () => {
  const fixture = { id: 'C01', review: { spec: 'x' }, expected: [{ id: 'E01', criterion: 'known criterion', severity: 'blocker', lens: 'Product' }] };
  const panel = { id: 'opaque', caseId: 'C01', provider: 'SECRET-PROVIDER', scheme: 'SECRET-SCHEME', repetition: 3, requestedModel: 'SECRET-MODEL', reports: [{ findings: [{ lens: 'Product', title: 'claim' }] }], triage: { findings: [] } };
  const payload = blindPayload(fixture, [panel]);
  assert.ok(!JSON.stringify(payload).includes('SECRET'));
  assert.deepEqual(payload.panels[0], { panelId: 'opaque', raw: [{ lens: 'Product', title: 'claim' }], triage: [] });
});

test('missing and duplicate judgments cannot silently grade a whole batch', () => {
  const expectedIds = ['a', 'b'];
  const judgment = id => ({ panelId: id, raw: [], triage: [], notes: [] });
  assert.deepEqual(parseJudgments({ judgments: expectedIds.map(judgment) }, expectedIds).judgments.map(row => row.panelId), expectedIds);
  assert.throws(() => parseJudgments({ judgments: [judgment('a')] }, expectedIds));
  assert.throws(() => parseJudgments({ judgments: [judgment('a'), judgment('a')] }, expectedIds));
  assert.throws(() => parseJudgments({ judgments: [{ ...judgment('a'), raw: [{ expectedId: 'E01', findingIndex: -1 }] }, judgment('b')] }, expectedIds));
});
