import { parseArgs } from 'node:util';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { corpus } from './corpus.mjs';
import { blindPayload, gradingPrompt, judgmentSchema, parseJudgments } from './grading.mjs';
import { invokeModel } from './invoke.mjs';
import { chooseModel } from './policy.mjs';
import { hash } from './runner-state.mjs';
import { frozenInputs } from './manifest.mjs';
import { acquireOwnership } from './ownership.mjs';
import { drainQueue } from './queue.mjs';
import { stopController } from './shutdown.mjs';
import { canGrade } from './grading-state.mjs';

const { values } = parseArgs({ options: { dir: { type: 'string', default: '.eval-work/2026-10-29-cli' },
  jobs: { type: 'string', default: '2' }, watch: { type: 'boolean', default: false } } });
const jobs = Number(values.jobs);
if (!Number.isInteger(jobs) || jobs < 1 || jobs > 4) throw new Error('Jobs must be 1..4');
const directory = resolve(values.dir), gradeDirectory = join(directory, 'grading');
await mkdir(join(gradeDirectory, 'cases'), { recursive: true });
const release = await acquireOwnership(gradeDirectory, 'Grading run');
const stop = stopController();
try {
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
const source = await Promise.all(['grading.mjs', 'grade.mjs', 'scoring.mjs'].map(name => readFile(new URL(name, import.meta.url), 'utf8')));
const gradingRuntime = await frozenInputs();
if (gradingRuntime.inputHash !== manifest.inputHash) throw new Error('Grading runtime differs from the frozen evaluation; use a separately documented grading run');
const graderHash = hash({ source, gradingRuntime }), done = new Set();

async function readyCases() {
  const names = await readdir(join(directory, 'panels')).catch(error => { if (error.code !== 'ENOENT') throw error; return []; });
  const panels = (await Promise.all(names.map(async name => {
    try { return JSON.parse(await readFile(join(directory, 'panels', name), 'utf8')); }
    catch (error) { if (values.watch && (error instanceof SyntaxError || error.code === 'ENOENT')) return null; throw error; }
  }))).filter(Boolean);
  const sealed = await readFile(join(directory, 'reviews.json')).then(() => true).catch(error => { if (error.code !== 'ENOENT') throw error; return false; });
  return corpus.filter(fixture => !done.has(fixture.id)).flatMap(fixture => {
    const planned = manifest.matrix.filter(row => row.caseId === fixture.id);
    if (!planned.length) return [];
    const rows = panels.filter(panel => panel.caseId === fixture.id);
    return canGrade(planned, rows, { watch: values.watch, sealed }) ? [{ fixture, panels: rows }] : [];
  });
}

async function gradeCase({ fixture, panels }) {
  const complete = panels.filter(panel => panel.status === 'complete' && panel.modelVerified).sort((a, b) => a.id.localeCompare(b.id));
  const payload = blindPayload(fixture, complete), payloadHash = hash(payload);
  let result = { judgments: [] }, record = null;
  if (complete.length) {
    const ids = complete.map(panel => panel.id);
    record = await invokeModel({ provider: 'codex', config: chooseModel('codex', 'strong', 'strong'),
      prompt: gradingPrompt(payload), key: `grading:${fixture.id}:${payloadHash}`, workDir: gradeDirectory,
      executionHash: graderHash, schema: judgmentSchema(ids), outputParser: value => parseJudgments(value, ids) });
    if (record.status !== 'complete' || !record.modelVerified || !record.effortVerified) throw new Error(`Grading failed for ${fixture.id}: ${record.error ?? 'model unverified'}`);
    result = record.review;
  }
  const output = { caseId: fixture.id, payloadHash, graderHash, graderCallId: record?.id ?? null,
    runtimeHash: gradingRuntime.inputHash, versions: gradingRuntime.versions,
    adjudication: 'blinded-machine-provisional', humanSignoff: false, ...result };
  await writeFile(join(gradeDirectory, 'cases', `${fixture.id}.json`), JSON.stringify(output, null, 2));
  done.add(fixture.id);
  console.log(JSON.stringify({ graded: done.size, total: new Set(manifest.matrix.map(row => row.caseId)).size,
    caseId: fixture.id, completePanels: complete.length }));
}

const totalCases = new Set(manifest.matrix.map(row => row.caseId)).size;
while (!stop.requested && done.size < totalCases) {
  const ready = await readyCases();
  await drainQueue(ready, { jobs, shouldStop: async () => stop.requested, run: gradeCase });
  if (!values.watch) break;
  if (!stop.requested && done.size < totalCases) await new Promise(resolve => setTimeout(resolve, 10000));
}
console.log(JSON.stringify({ gradedCases: done.size, totalCases, interrupted: stop.requested, humanSignoff: false }));
} finally { stop.dispose(); await release(); }
