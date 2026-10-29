import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { budgetCalls, acquireBudgetLock } from '../budget-ledger.mjs';
import { spentClaude } from '../manifest.mjs';
import { Budget } from '../runner-state.mjs';

test('budget accounting includes earlier smoke and failed calls across replacement run directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mob-budget-'));
  try {
    for (const [run, cost] of [['smoke', .1], ['replacement', .2]]) {
      const path = join(root, run, 'calls', 'opaque'); await mkdir(path, { recursive: true });
      await writeFile(join(path, 'record.json'), JSON.stringify({ provider: 'claude', status: 'error', costUsd: cost }));
    }
    assert.ok(Math.abs(spentClaude(await budgetCalls(root)) - .3) < 1e-9);
    const release = await acquireBudgetLock(root);
    await assert.rejects(acquireBudgetLock(root), /locked/i);
    await release();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('temporary reservations wait for known refunds instead of marking later panels failed', async () => {
  const budget = new Budget(.25, .25);
  await budget.reserveWhenAvailable();
  let granted = false;
  const waiting = budget.reserveWhenAvailable().then(value => { granted = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(granted, false);
  budget.settle(.25, 0);
  assert.equal(await waiting, .25);
  budget.settle(.25, null);
  await assert.rejects(budget.reserveWhenAvailable(), /unknown/i);
});

test('decimal reservations do not leave a phantom in-flight call after the cap is spent', async () => {
  const budget = new Budget(.8, .2);
  for (let i = 0; i < 4; i++) await budget.reserveWhenAvailable();
  for (let i = 0; i < 4; i++) budget.settle(.2, .19);
  await assert.rejects(budget.reserveWhenAvailable(), /budget/i);
});
