import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './runner-state.mjs';
import { modelConfiguration, validateCodexCatalog } from './policy.mjs';
import { runProcess } from './process.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
export async function frozenInputs() {
  const execution = ['adapters', 'invoke', 'metadata', 'process', 'policy', 'prompts', 'runner-state', 'manifest', 'panel', 'run', 'corpus', 'budget-ledger',
    'queue', 'ownership', 'shutdown', 'grading-state'];
  const entries = [...(await readdir(join(here, 'cases'))).filter(name => name.endsWith('.mjs')).map(name => `cases/${name}`),
    ...execution.map(name => `${name}.mjs`), '../../skills/mob-review/SKILL.md', '../../skills/mob-review/model-selection.md'];
  const files = Object.fromEntries(await Promise.all(entries.map(async name => [name, hash(await readFile(join(here, name), 'utf8'))])));
  const versions = Object.fromEntries(await Promise.all(['claude', 'codex'].map(async provider => {
    const result = await runProcess(provider, ['--version'], { cwd: here, input: '', timeoutMs: 10000 });
    if (result.code !== 0) throw new Error(`Cannot determine ${provider} version`);
    return [provider, result.stdout.trim()];
  })));
  const names = ['ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_EFFORT_LEVEL'];
  const environmentHashes = Object.fromEntries(names.map(name => [name, hash(process.env[name] ?? '<unset>')]));
  const discovery = await runProcess('codex', ['debug', 'models', '--bundled'], { cwd: here, input: '', timeoutMs: 10000 });
  if (discovery.code !== 0) throw new Error('Cannot read the launching Codex CLI catalog');
  const catalog = validateCodexCatalog(JSON.parse(discovery.stdout));
  return { inputHash: hash({ files, versions, environmentHashes, catalog }), files, versions, environmentHashes,
    modelConfiguration, codexCatalog: catalog };
}

export async function existingCalls(workDir) {
  const calls = join(workDir, 'calls');
  const names = await readdir(calls).catch(error => { if (error.code !== 'ENOENT') throw error; return []; });
  return Promise.all(names.map(async name => JSON.parse(await readFile(join(calls, name, 'record.json'), 'utf8'))));
}

export function spentClaude(calls) {
  const claude = calls.filter(call => call.provider === 'claude');
  if (claude.some(call => !Number.isFinite(call.costUsd) || call.status === 'started')) return null;
  return claude.reduce((sum, call) => sum + call.costUsd, 0);
}
