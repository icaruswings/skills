import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canGrade } from '../grading-state.mjs';

const planned = [{ key: 'first' }, { key: 'second' }];
const complete = key => ({ key, status: 'complete', modelVerified: true });

test('an old partial seal during resume never makes a watcher ready', () => {
  assert.equal(canGrade(planned, [complete('first')], { watch: true, sealed: true }), false);
  assert.equal(canGrade(planned, [], { watch: true, sealed: true }), false);
});

test('a watcher waits for failed or unverified panels even when every key exists', () => {
  assert.equal(canGrade(planned, [complete('first'), { key: 'second', status: 'error', modelVerified: false }],
    { watch: true, sealed: true }), false);
  assert.equal(canGrade(planned, [complete('first'), { ...complete('second'), modelVerified: false }],
    { watch: true, sealed: false }), false);
});

test('every planned complete verified panel makes grading ready without a seal', () => {
  for (const watch of [true, false]) {
    assert.equal(canGrade(planned, [complete('second'), complete('first')], { watch, sealed: false }), true);
  }
});

test('a sealed nonwatch run can grade its partial evidence', () => {
  assert.equal(canGrade(planned, [complete('first')], { watch: false, sealed: true }), true);
  assert.equal(canGrade(planned, [complete('first'), { key: 'second', status: 'error' }],
    { watch: false, sealed: true }), true);
  assert.equal(canGrade(planned, [complete('first')], { watch: false, sealed: false }), false);
});

test('foreign or duplicate keys cannot establish grading readiness', () => {
  const options = { watch: false, sealed: true };
  assert.equal(canGrade(planned, [complete('foreign')], options), false);
  assert.equal(canGrade(planned, [complete('first'), complete('first')], options), false);
  assert.equal(canGrade([{ key: 'first' }, { key: 'first' }], [complete('first')], options), false);
  assert.equal(canGrade(planned, [{ status: 'complete', modelVerified: true }], options), false);
  assert.equal(canGrade([], [], options), false);
});
