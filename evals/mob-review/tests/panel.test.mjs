import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runPanel } from '../panel.mjs';

const fixture = { id: 'C01', split: 'pilot', review: { filename: 'module.js', spec: 'Return label', before: 'one', after: 'two', context: '' }, lenses: [{ name: 'Product', tier: 'economy' }] };
const row = { key: 'codex:tiered:C01:1', caseId: 'C01', split: 'pilot', provider: 'codex', scheme: 'tiered', repetition: 1 };
test('a panel uses isolated lens calls followed by Strong triage and can resume without spending', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-panel-'));
  const calls = [];
  const invoke = async input => { calls.push(input); return { id: String(calls.length), status: 'complete', modelVerified: true, effortVerified: true, review: { findings: [], gaps: [] } }; };
  try {
    const first = await runPanel({ row, fixture, workDir: directory, runHash: 'frozen', invoke });
    assert.equal(first.status, 'complete');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].config.model, 'gpt-6-luna');
    assert.equal(calls[1].config.model, 'gpt-6-astra');
    await runPanel({ row, fixture, workDir: directory, runHash: 'frozen', invoke });
    assert.equal(calls.length, 2);
    await assert.rejects(runPanel({ row, fixture, workDir: directory, runHash: 'changed', invoke }), /changed/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an unverified model prevents triage and marks the panel incomplete', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-panel-'));
  let count = 0;
  const invoke = async () => { count++; return { id: 'x', status: 'complete', modelVerified: false, review: { findings: [], gaps: [] } }; };
  try {
    const result = await runPanel({ row, fixture, workDir: directory, runHash: 'frozen', invoke });
    assert.equal(result.status, 'error');
    assert.equal(count, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an error panel can resume after its failed call is safely reconciled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-panel-'));
  let first = true;
  const invoke = async () => {
    if (first) { first = false; return { id: 'failed', status: 'error', error: 'temporary' }; }
    return { id: 'ok', status: 'complete', modelVerified: true, effortVerified: true, review: { findings: [], gaps: [] } };
  };
  try {
    assert.equal((await runPanel({ row, fixture, workDir: directory, runHash: 'frozen', invoke })).status, 'error');
    assert.equal((await runPanel({ row, fixture, workDir: directory, runHash: 'frozen', invoke })).status, 'complete');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
