import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chooseModel } from './policy.mjs';
import { reviewerPrompt, triagePrompt, schemaForLenses } from './prompts.mjs';
import { invokeModel } from './invoke.mjs';
import { hash, opaqueId } from './runner-state.mjs';

export async function runPanel({ row, fixture, workDir, budget, runHash, invoke = invokeModel, retryKnownFailures = false }) {
  const id = opaqueId(row.key), inputHash = hash({ row, review: fixture.review, lenses: fixture.lenses, runHash });
  const path = join(workDir, 'panels', `${id}.json`);
  await mkdir(join(workDir, 'panels'), { recursive: true });
  const cached = await readFile(path, 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (cached?.inputHash !== undefined && cached.inputHash !== inputHash) throw new Error('Panel inputs changed; use a new run directory');
  if (cached?.status === 'complete') return cached;
  const panel = { ...row, id, inputHash, status: 'started', modelVerified: false, reports: [], callIds: [] };
  const started = Date.now();
  const call = async (stage, tier, prompt) => {
    const record = await invoke({ provider: row.provider, config: chooseModel(row.provider, row.scheme, tier),
      key: `${row.key}:${stage}`, prompt, workDir, budget, executionHash: runHash, retryKnownFailures,
      schema: schemaForLenses(stage === 'triage' ? fixture.lenses.map(lens => lens.name) : [stage]) });
    panel.callIds.push(record.id);
    if (record.status !== 'complete' || !record.modelVerified || !record.effortVerified) throw new Error(record.error ?? 'Unverified effective model/effort');
    return record.review;
  };
  try {
    for (const lens of fixture.lenses) {
      const report = await call(lens.name, lens.tier, reviewerPrompt(fixture, lens));
      if (report.findings.some(finding => finding.lens !== lens.name)) throw new Error('Reviewer changed the assigned lens');
      panel.reports.push({ lens: lens.name, ...report });
    }
    panel.triage = await call('triage', 'strong', triagePrompt(fixture, panel.reports));
    const names = fixture.lenses.map(lens => lens.name);
    if (panel.triage.findings.some(finding => !names.includes(finding.lens))) throw new Error('Triage lost lens attribution');
    panel.modelVerified = true;
    panel.status = 'complete';
  } catch (error) { panel.status = 'error'; panel.error = error.message; }
  panel.elapsedMs = Date.now() - started;
  await writeFile(path, JSON.stringify(panel, null, 2));
  return panel;
}
