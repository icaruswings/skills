import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { invokeModel } from '../invoke.mjs';
import { Budget, opaqueId } from '../runner-state.mjs';

// Only the external CLI boundary is replaced. Records, subprocesses, parsing,
// reservations and concurrent invocation all use the production implementation.
async function withFakeClaude(run, { invalidOutput = false, invalidReview = false, delayMs = 0 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mob-invoke-test-'));
  const bin = join(root, 'bin'), workDir = join(root, 'work'), executions = join(root, 'executions.ndjson');
  const originalPath = process.env.PATH;
  try {
    await mkdir(bin);
    await mkdir(workDir);
    const response = JSON.stringify({ is_error: false, structured_output: invalidReview ? { findings: [] } : { findings: [], gaps: [] },
      total_cost_usd: 0.02, modelUsage: { 'claude-haiku-4-5': { inputTokens: 100,
        cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 10 } } });
    const script = `#!${process.execPath}
const { appendFileSync } = require('node:fs');
appendFileSync(${JSON.stringify(executions)}, JSON.stringify({ cwd: process.cwd() }) + '\\n');
process.stdin.resume();
process.stdin.on('end', () => setTimeout(() => {
  process.stdout.write(${JSON.stringify(invalidOutput ? 'invalid JSON' : response)} + '\\n');
}, ${delayMs}));
`;
    await writeFile(join(bin, 'claude'), script, { mode: 0o700 });
    process.env.PATH = `${bin}${delimiter}${originalPath ?? ''}`;
    const attempts = async () => {
      const text = await readFile(executions, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return ''; });
      return text.trim() ? text.trim().split('\n').map(JSON.parse) : [];
    };
    const record = key => readFile(join(workDir, 'calls', opaqueId(key), 'record.json'), 'utf8').then(JSON.parse);
    await run({ workDir, attempts, record });
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    await rm(root, { recursive: true, force: true });
  }
}

const invocation = (workDir, budget, key, extra = {}) => ({ provider: 'claude',
  config: { model: 'haiku' }, prompt: 'Offline synthetic test.', executionHash: 'offline-test',
  workDir, budget, key, ...extra });

test('pre-spawn setup failure records zero cost and releases its reservation without launching Claude', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts, record }) => {
    const budget = new Budget(0.2, 0.2), key = 'setup-failure';
    await mkdir(join(workDir, 'calls', opaqueId(key), 'prompt.txt'), { recursive: true });
    let result;
    await assert.doesNotReject(async () => { result = await invokeModel(invocation(workDir, budget, key)); });
    assert.equal(result.status, 'error');
    assert.equal(result.costUsd, 0);
    assert.equal((await record(key)).costUsd, 0);
    assert.equal((await record(key)).status, 'error');
    assert.equal((await attempts()).length, 0);
    assert.equal(budget.spent, 0);
    assert.equal(budget.reserved, 0);
    assert.equal(budget.activeReservations, 0);
    assert.equal(budget.reserve(), 0.2);
    budget.settle(0.2, 0);
  });
});

test('isolated-directory cleanup failure preserves known usage and releases its reservation', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts, record }) => {
    const budget = new Budget(0.4, 0.2), key = 'cleanup-failure', isolated = [];
    try {
      const result = await invokeModel(invocation(workDir, budget, key, {
        removeIsolated: async path => { isolated.push(path); throw new Error('simulated cleanup failure'); },
      }));
      assert.equal(isolated.length, 1, 'exercise the failing cleanup boundary');
      assert.equal((await attempts()).length, 1);
      assert.equal(result.costUsd, 0.02);
      assert.equal((await record(key)).costUsd, 0.02);
      assert.notEqual((await record(key)).status, 'started');
      assert.equal(budget.spent, 0.02);
      assert.equal(budget.reserved, 0);
      assert.equal(budget.activeReservations, 0);
    } finally {
      await Promise.all(isolated.map(path => rm(path, { recursive: true, force: true })));
    }
  });
});

test('simultaneous identical invocation keys incur one call and persist one usage record', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts, record }) => {
    const budget = new Budget(0.4, 0.2), key = 'same-call';
    const results = await Promise.allSettled([
      invokeModel(invocation(workDir, budget, key)),
      invokeModel(invocation(workDir, budget, key)),
    ]);
    assert.equal((await attempts()).length, 1, 'ownership must prevent duplicate paid processes');
    const completed = results.filter(result => result.status === 'fulfilled');
    assert.ok(completed.length >= 1);
    assert.ok(completed.every(result => result.value.status === 'complete'));
    assert.equal((await record(key)).costUsd, 0.02);
    assert.equal((await record(key)).status, 'complete');
    const directories = await readdir(join(workDir, 'calls'), { withFileTypes: true });
    let usageRecords = 0;
    for (const entry of directories.filter(entry => entry.isDirectory())) {
      const stored = await readFile(join(workDir, 'calls', entry.name, 'record.json'), 'utf8')
        .catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
      if (stored !== null) usageRecords++;
    }
    assert.equal(usageRecords, 1);
    assert.equal(budget.spent, 0.02);
    assert.equal(budget.reserved, 0);
    assert.equal(budget.activeReservations, 0);
    assert.equal((await invokeModel(invocation(workDir, budget, key))).status, 'complete');
    assert.equal((await attempts()).length, 1, 'a later owner must reuse the completed record');
    assert.equal(budget.spent, 0.02);
  }, { delayMs: 40 });
});

test('unparseable Claude output records unknown spend and blocks the next reservation', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts, record }) => {
    const budget = new Budget(0.4, 0.2), key = 'invalid-output';
    const result = await invokeModel(invocation(workDir, budget, key));
    assert.equal(result.status, 'error');
    assert.equal(result.costUsd, null);
    assert.equal((await record(key)).costUsd, null);
    assert.equal((await attempts()).length, 1);
    assert.equal(budget.spent, null);
    assert.equal(budget.reserved, 0);
    assert.equal(budget.activeReservations, 0);
    await assert.rejects(budget.reserveWhenAvailable(), /unknown spending/i);
  }, { invalidOutput: true });
});

test('budget rejection leaves no recordless call directory and releases call ownership', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts }) => {
    const key = 'budget-rejection';
    await assert.rejects(invokeModel(invocation(workDir, new Budget(0.1, 0.2), key)), /budget/i);
    await assert.rejects(readdir(join(workDir, 'calls', opaqueId(key))), { code: 'ENOENT' });
    assert.equal((await attempts()).length, 0);
    const result = await invokeModel(invocation(workDir, new Budget(0.4, 0.2), key));
    assert.equal(result.status, 'complete');
    assert.equal((await attempts()).length, 1);
  });
});

test('known paid failures retain their original record and permit only one separately billed retry', { concurrency: false }, async () => {
  await withFakeClaude(async ({ workDir, attempts, record }) => {
    const budget = new Budget(0.6, 0.2), key = 'paid-failure';
    const first = await invokeModel(invocation(workDir, budget, key));
    assert.equal(first.status, 'error');
    assert.equal(first.costUsd, 0.02);
    const retry = await invokeModel(invocation(workDir, budget, key, { retryKnownFailures: true }));
    assert.equal(retry.status, 'error');
    assert.equal(retry.costUsd, 0.02);
    assert.equal(retry.key, 'paid-failure:retry1');
    assert.deepEqual(await record(key), first);
    assert.equal((await record('paid-failure:retry1')).costUsd, 0.02);
    assert.equal(budget.spent, 0.04);
    assert.equal(budget.activeReservations, 0);
    await assert.rejects(invokeModel(invocation(workDir, budget, key, { retryKnownFailures: true })), /incomplete/i);
    assert.equal((await attempts()).length, 2);
  }, { invalidReview: true });
});
