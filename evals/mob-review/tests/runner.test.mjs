import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeMatrix, callIdentity, Budget, assertResume, opaqueId } from '../runner-state.mjs';

test('matrix pairs every case and repetition across both providers and arms', () => {
  const matrix = makeMatrix([{ id: 'C01', split: 'pilot' }, { id: 'C17', split: 'holdout' }], 3);
  assert.equal(matrix.length, 24);
  assert.equal(new Set(matrix.map(row => row.key)).size, 24);
  assert.equal(matrix.filter(row => row.provider === 'claude' && row.scheme === 'tiered').length, 6);
  assert.notEqual(opaqueId(matrix[0].key), opaqueId(matrix[1].key));
});

test('input or model changes invalidate resumes, and independent arms never reuse a call', () => {
  const input = { key: 'codex:tiered:C01:1:Product', prompt: 'one', config: { model: 'gpt-6-luna' } };
  const identity = callIdentity(input);
  assert.notEqual(identity, callIdentity({ ...input, key: input.key.replace('tiered', 'strong') }));
  assert.notEqual(identity, callIdentity({ ...input, prompt: 'two' }));
  assert.throws(() => assertResume({ ...input, identity: 'old' }, identity), /changed/i);
  assertResume({ ...input, identity }, identity);
});

test('concurrent call reservations prevent overspend and missing usage blocks later calls', () => {
  const budget = new Budget(1, .25);
  for (let i = 0; i < 4; i++) assert.equal(budget.reserve(), .25);
  assert.throws(() => budget.reserve(), /budget/i);
  budget.settle(.25, .05);
  assert.throws(() => budget.reserve(), /budget/i);
  budget.settle(.25, .05);
  assert.equal(budget.reserve(), .25);
  budget.settle(.25, null);
  assert.throws(() => budget.reserve(), /unknown/i);
});

test('duplicate, empty, or unsupported provider lists cannot create colliding paid calls', () => {
  const cases = [{ id: 'C01', split: 'pilot' }];
  assert.throws(() => makeMatrix(cases, 1, ['claude', 'claude']), /provider/i);
  assert.throws(() => makeMatrix(cases, 1, []), /provider/i);
  assert.throws(() => makeMatrix(cases, 1, ['unknown']), /provider/i);
});
