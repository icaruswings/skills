import { mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export async function acquireOwnership(directory, label) {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, '.owner-lock'), metadata = join(lock, 'owner.json');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`${label} directory is already owned; inspect ${metadata} before removing a stale lock`);
    throw error;
  }
  const identity = await lstat(lock), token = randomUUID();
  try {
    await writeFile(metadata, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), label, token }));
  } catch (error) {
    await removeSameLock(lock, identity);
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    const owner = await readFile(metadata, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (owner?.token === token) await removeSameLock(lock, identity);
    released = true;
  };
}

async function removeSameLock(lock, identity) {
  const current = await lstat(lock).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (current?.dev === identity.dev && current?.ino === identity.ino) await rm(lock, { recursive: true });
}
