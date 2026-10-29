import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { corpus, verifyCorpus } from './corpus.mjs';
import { Budget, makeMatrix } from './runner-state.mjs';
import { frozenInputs, spentClaude } from './manifest.mjs';
import { budgetCalls, acquireBudgetLock } from './budget-ledger.mjs';
import { runPanel } from './panel.mjs';

const { values } = parseArgs({ options: {
  dir: { type: 'string', default: '.eval-work/2026-10-29' }, providers: { type: 'string', default: 'claude,codex' },
  repetitions: { type: 'string', default: '3' }, jobs: { type: 'string', default: '4' },
  'claude-cap': { type: 'string' }, split: { type: 'string', default: 'all' }, cases: { type: 'string' },
  'budget-root': { type: 'string', default: '.eval-work' },
  'retry-known-failures': { type: 'boolean', default: false },
} });
const workDir = resolve(values.dir), providers = values.providers.split(',');
const budgetRoot = resolve(values['budget-root']);
if (relative(budgetRoot, workDir).startsWith('..')) throw new Error('Run directory must be inside the shared budget root');
if (providers.some(name => !['claude', 'codex'].includes(name))) throw new Error('Invalid provider');
if (providers.includes('claude') && !(Number(values['claude-cap']) > 0)) throw new Error('Set the authorized Claude spending cap explicitly');
const jobs = Number(values.jobs);
if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error('Jobs must be 1..8');
let fixtures = corpus.filter(fixture => values.split === 'all' || fixture.split === values.split);
if (values.cases) fixtures = fixtures.filter(fixture => values.cases.split(',').includes(fixture.id));
if (!fixtures.length) throw new Error('No cases selected');
verifyCorpus(fixtures);
const matrix = makeMatrix(fixtures, Number(values.repetitions), providers), frozen = await frozenInputs();
await mkdir(workDir, { recursive: true });
const manifestPath = join(workDir, 'manifest.json');
const previous = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
if (previous && previous.inputHash !== frozen.inputHash) throw new Error('Frozen evaluation inputs changed');
if (previous && JSON.stringify(previous.matrix) !== JSON.stringify(matrix)) throw new Error('Planned evaluation matrix changed; use a new run directory');
const manifest = { ...frozen, createdAt: previous?.createdAt ?? new Date().toISOString(), repetitions: Number(values.repetitions),
  claudeCapUsd: Number(values['claude-cap'] ?? 0), expectedPanels: matrix.length, matrix,
  semantics: 'Independent tool-free CLI reviewers plus Strong CLI triage; native subagent launch behavior is tested separately.', humanAdjudication: 'pending' };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
const release = providers.includes('claude') ? await acquireBudgetLock(budgetRoot) : async () => {};
let stopRequested = false;
process.once('SIGINT', () => { stopRequested = true; });
process.once('SIGTERM', () => { stopRequested = true; });
try {
const budget = new Budget(manifest.claudeCapUsd, .2, spentClaude(await budgetCalls(budgetRoot)));
const results = [];
for (const split of ['pilot', 'holdout']) {
  const queue = matrix.filter(row => row.split === split);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (cursor < queue.length) {
      const stopFile = await readFile(join(workDir, 'STOP')).then(() => true).catch(error => { if (error.code !== 'ENOENT') throw error; return false; });
      if (stopRequested || stopFile) { stopRequested = true; break; }
      const row = queue[cursor++], fixture = fixtures.find(fixture => fixture.id === row.caseId);
      const panel = await runPanel({ row, fixture, workDir, budget, runHash: frozen.inputHash,
        retryKnownFailures: values['retry-known-failures'] });
      results.push(panel);
      const progress = { at: new Date().toISOString(), complete: results.length, total: matrix.length,
        key: row.key, status: panel.status, error: panel.error, claudeSpentUsd: budget.spent };
      await appendFile(join(workDir, 'progress.ndjson'), JSON.stringify(progress) + '\n');
      console.log(JSON.stringify(progress));
    }
  }));
}
const current = await frozenInputs();
if (current.inputHash !== frozen.inputHash) throw new Error('Inputs changed during execution; results require a separate run');
await writeFile(join(workDir, 'reviews.json'), JSON.stringify(results.sort((a, b) => a.id.localeCompare(b.id)), null, 2));
console.log(JSON.stringify({ panels: results.length, failures: results.filter(panel => panel.status !== 'complete').length,
  claudeSpentUsd: budget.spent, interrupted: stopRequested, humanAdjudication: 'pending' }));
} finally { await release(); }
