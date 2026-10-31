import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function codexModelMetadata(threadId, sessionRoot = join(homedir(), '.codex/sessions')) {
  if (!threadId) return {};
  for (const offset of [0, -1, 1]) {
    const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10).replaceAll('-', '/');
    const directory = join(sessionRoot, date);
    const names = await readdir(directory).catch(() => []);
    const name = names.find(name => name.endsWith(`${threadId}.jsonl`));
    if (!name) continue;
    const events = (await readFile(join(directory, name), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const turn = events.find(event => event.type === 'turn_context')?.payload;
    return { effectiveModel: turn?.model ?? null, effectiveEffort: turn?.effort ?? null };
  }
  return {};
}
