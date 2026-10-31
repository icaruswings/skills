import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drainQueue } from '../queue.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('workers recheck the final row after an asynchronous stop barrier', { timeout: 1000 }, async () => {
  const barrier = deferred(), seen = [];
  let checks = 0;
  const results = await drainQueue(['first', 'last'], { jobs: 2,
    shouldStop: async () => {
      checks++;
      if (checks === 1) return false;
      if (checks === 3) barrier.resolve();
      await barrier.promise;
      return false;
    },
    run: async row => { seen.push(row); return row.toUpperCase(); },
  });
  assert.deepEqual(seen, ['first', 'last']);
  assert.deepEqual(results, ['FIRST', 'LAST']);
});

test('worker failure stops new rows and waits for a pending invocation before rejecting', { timeout: 1000 }, async () => {
  const started = deferred(), finish = deferred(), seen = [], failure = new Error('worker failed');
  let settled = false, pendingFinished = false;
  const result = drainQueue([0, 1, 2], { jobs: 2, shouldStop: async () => false,
    run: async row => {
      seen.push(row);
      if (row === 0) { await started.promise; throw failure; }
      started.resolve();
      await finish.promise;
      pendingFinished = true;
    },
  }).then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await started.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  finish.resolve();
  const error = await result;
  assert.ok(error instanceof AggregateError);
  assert.deepEqual(error.errors, [failure]);
  assert.equal(pendingFinished, true);
  assert.deepEqual(seen, [0, 1]);
});

test('a rejected stop check waits for active work and prevents further scheduling', { timeout: 1000 }, async () => {
  const stop = deferred(), started = deferred(), finish = deferred(), seen = [];
  const failure = new Error('cannot inspect stop file');
  let checks = 0, settled = false;
  const result = drainQueue([0, 1, 2], { jobs: 2,
    shouldStop: () => ++checks === 1 ? stop.promise : false,
    run: async row => { seen.push(row); started.resolve(); await finish.promise; },
  }).then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await started.promise;
  stop.reject(failure);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  finish.resolve();
  const error = await result;
  assert.ok(error instanceof AggregateError);
  assert.deepEqual(error.errors, [failure]);
  assert.deepEqual(seen, [0]);
});

test('a true stop check cancels scheduling and an empty queue starts no work', async () => {
  let calls = 0;
  const options = { jobs: 2, shouldStop: async () => true, run: async () => { calls++; } };
  assert.deepEqual(await drainQueue([0, 1], options), []);
  assert.deepEqual(await drainQueue([], options), []);
  assert.equal(calls, 0);
});

test('invalid queue arguments fail before work starts', async () => {
  const options = { jobs: 1, shouldStop: async () => false, run: async row => row };
  await assert.rejects(drainQueue(null, options), /rows/i);
  await assert.rejects(drainQueue([], { ...options, jobs: 0 }), /jobs/i);
  await assert.rejects(drainQueue([], { ...options, run: null }), /run/i);
  await assert.rejects(drainQueue([], { ...options, shouldStop: null }), /shouldStop/i);
});
