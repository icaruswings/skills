import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpus, verifyCorpus } from './corpus.mjs';
import { existingCalls } from './manifest.mjs';
import { budgetCalls } from './budget-ledger.mjs';
import { blindPayload } from './grading.mjs';
import { buildReport, renderReport, attemptIdentity } from './reporting.mjs';
import { verifyEvidenceSources } from './evidence.mjs';
import { hash } from './runner-state.mjs';
import { runProcess } from './process.mjs';

const { values } = parseArgs({ options: { dir: { type: 'string', default: '.eval-work/2026-10-29-cli' },
  'budget-root': { type: 'string', default: '.eval-work' }, out: { type: 'string', default: 'evals/mob-review/results/2026-10-29' },
  'source-commit': { type: 'string' } } });
if (!values['source-commit']) throw new Error('Specify the exact evaluated source commit');
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = resolve(values.dir), output = resolve(values.out);
if (output === directory || relative(directory, output).split('/')[0] !== '..') throw new Error('Published output must be separate from raw run data');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson(join(directory, 'manifest.json'));
const panels = await readJson(join(directory, 'reviews.json'));
const selected = corpus.filter(fixture => manifest.matrix.some(row => row.caseId === fixture.id));
const graded = (await Promise.all(selected.map(async fixture => {
  const path = join(directory, 'grading', 'cases', `${fixture.id}.json`);
  const result = await readJson(path).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (!result) return null;
  const complete = panels.filter(panel => panel.caseId === fixture.id && panel.status === 'complete' && panel.modelVerified).sort((a, b) => a.id.localeCompare(b.id));
  if (result.caseId !== fixture.id || result.payloadHash !== hash(blindPayload(fixture, complete))) throw new Error(`Stale or mismatched judgments for ${fixture.id}`);
  return result;
}))).filter(Boolean);
const runCalls = await existingCalls(directory), gradingCalls = await existingCalls(join(directory, 'grading'));
const campaignCalls = await budgetCalls(resolve(values['budget-root']));
const commit = await runProcess('git', ['rev-parse', '--verify', `${values['source-commit']}^{commit}`], { cwd: root, input: '' });
if (commit.code !== 0) throw new Error('Evaluated source commit does not exist locally');
const sourceCommit = commit.stdout.trim();
// Bind public evidence to the committed execution source, including the oracle.
await verifyEvidenceSources(manifest, { working: name => readFile(resolve(root, 'evals/mob-review', name), 'utf8'), committed: async name => {
  const path = relative(root, resolve(root, 'evals/mob-review', name));
  const source = await runProcess('git', ['show', `${sourceCommit}:${path}`], { cwd: root, input: '' });
  if (source.code !== 0) throw new Error(`Cannot read evaluated source: ${path}`);
  return source.stdout;
} });
const judgments = graded.flatMap(result => result.judgments);
const report = buildReport({ manifest, fixtures: selected, panels, judgments, runCalls, gradingCalls, campaignCalls, sourceCommit });
const humanReview = { status: 'human-pending', humanSignoff: false, instructions: [
  'Supply a blinded copy of the truth labels, code briefs, findings, and provisional matches before showing provider/policy mappings.',
  'Approve or correct each truth label and severity; adjudicate unmatched findings as valid defects, nonblocking advice, or false alarms.',
  'Resolve triage losses and severity disputes, then review paired gates and record a named human acceptance decision. Rerun scores after corrections.',
], truthLabels: selected.map(fixture => ({ caseId: fixture.id, expected: fixture.expected, status: 'human-pending' })),
  severityDisputes: report.scores.filter(score => score.severityMismatches.length).map(score => ({ panelId: score.panelId, caseId: score.caseId, mismatches: score.severityMismatches })),
  triageLosses: report.scores.filter(score => score.triageLostIds.length).map(score => ({ panelId: score.panelId, caseId: score.caseId, expectedIds: score.triageLostIds })),
  unmatched: report.humanQueue,
};
const callFields = ['id', 'key', 'identity', 'provider', 'requestedModel', 'requestedEffort', 'effectiveModel', 'effectiveEffort',
  'status', 'startedAt', 'elapsedMs', 'tokens', 'costUsd', 'modelVerified', 'effortVerified', 'promptHash'];
const normalizedCalls = calls => calls.map(call => Object.fromEntries(callFields.filter(key => Object.hasOwn(call, key)).map(key => [key, call[key]])));
await mkdir(output, { recursive: true });
const artifacts = { 'manifest.json': { ...manifest, evaluatedSourceCommit: sourceCommit }, 'reviews.json': panels,
  'judgments.json': graded, 'oracles.json': verifyCorpus(selected), 'summary.json': report,
  'human-queue.json': report.humanQueue, 'human-review.json': humanReview,
  'calls.json': { comparison: normalizedCalls(runCalls), grading: normalizedCalls(gradingCalls),
    overhead: normalizedCalls(campaignCalls.filter(call => ![...runCalls, ...gradingCalls].some(known => attemptIdentity(known) === attemptIdentity(call)))) } };
await Promise.all(Object.entries(artifacts).map(([name, data]) => writeFile(join(output, name), JSON.stringify(data, null, 2) + '\n')));
await writeFile(join(output, 'REPORT.md'), renderReport(report));
console.log(JSON.stringify({ output, panels: report.scores.length, gradedCases: graded.length, gates: report.gates,
  claudeSpentUsd: report.resources.campaign.claude.knownCostUsd }));
