import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireOwnership } from '../ownership.mjs';

test('a second owner is rejected until the first releases its directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-owner-'));
  try {
    const release = await acquireOwnership(directory, 'grading');
    const owner = JSON.parse(await readFile(join(directory, '.owner-lock', 'owner.json'), 'utf8'));
    assert.equal(owner.pid, process.pid);
    assert.equal(owner.label, 'grading');
    assert.ok(Number.isFinite(Date.parse(owner.startedAt)));
    await assert.rejects(acquireOwnership(directory, 'grading'), /already owned.*owner\.json/i);
    await release();
    const nextRelease = await acquireOwnership(directory, 'grading');
    await release();
    await assert.rejects(acquireOwnership(directory, 'grading'), /already owned/i);
    await nextRelease();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a rejected acquisition preserves an existing lock with incomplete metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-owner-'));
  try {
    const lock = join(directory, '.owner-lock');
    await mkdir(lock);
    await assert.rejects(acquireOwnership(directory, 'review'), /already owned/i);
    await access(lock);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('metadata setup failure cleans up only the newly acquired lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-owner-'));
  try {
    await assert.rejects(acquireOwnership(directory, 1n), TypeError);
    await assert.rejects(access(join(directory, '.owner-lock')), { code: 'ENOENT' });
    const release = await acquireOwnership(directory, 'review');
    await release();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an old owner does not remove a replacement owner lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mob-owner-'));
  try {
    const release = await acquireOwnership(directory, 'old');
    await rm(join(directory, '.owner-lock'), { recursive: true });
    const replacementRelease = await acquireOwnership(directory, 'replacement');
    await release();
    await assert.rejects(acquireOwnership(directory, 'other'), /already owned/i);
    await replacementRelease();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
