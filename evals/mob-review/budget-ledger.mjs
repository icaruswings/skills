import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// The common accounting root includes every replacement run, smoke, and failed
// attempt. A separate process cannot spend against the same cap concurrently.
export async function budgetCalls(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(error => { if (error.code !== 'ENOENT') throw error; return []; });
  const records = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.budget-lock') continue;
    const child = join(root, entry.name);
    if (entry.name !== 'calls') { records.push(...await budgetCalls(child)); continue; }
    for (const name of await readdir(child)) records.push(JSON.parse(await readFile(join(child, name, 'record.json'), 'utf8')));
  }
  return records;
}

export async function acquireBudgetLock(root) {
  await mkdir(root, { recursive: true });
  const path = join(root, '.budget-lock');
  try { await mkdir(path); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Claude budget is locked by another runner; inspect its owner before removing a stale lock'); throw error; }
  await writeFile(join(path, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return () => rm(path, { recursive: true });
}
