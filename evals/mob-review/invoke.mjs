import { mkdir, readFile, writeFile, mkdtemp, rm, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cliArguments, modelMatches, parseClaude, parseCodex } from './adapters.mjs';
import { runProcess } from './process.mjs';
import { codexModelMetadata } from './metadata.mjs';
import { callIdentity, opaqueId, assertResume } from './runner-state.mjs';
import { reviewSchema } from './prompts.mjs';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function writeRecord(path, record) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2));
  await rename(temporary, path);
}
export async function invokeModel(options) {
  const { provider, config, prompt, key, workDir, budget, schema = reviewSchema, executionHash, outputParser, retryKnownFailures = false } = options;
  const input = { key, provider, config, prompt, schema, executionHash };
  const identity = callIdentity(input), id = opaqueId(key);
  const directory = join(workDir, 'calls', id);
  const recordPath = join(directory, 'record.json');
  const existing = await readJson(recordPath).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existing?.status === 'error' && existing.identity === identity && retryKnownFailures) {
    if (provider === 'claude' && !Number.isFinite(existing.costUsd)) throw new Error('Unknown previous spending; reconcile before retrying');
    return invokeModel({ ...options, key: `${key}:retry1`, retryKnownFailures: false });
  }
  if (existing) { assertResume(existing, identity); return existing; }
  const allowance = provider === 'claude' ? await budget.reserveWhenAvailable() : undefined;
  await mkdir(directory, { recursive: true });
  const record = { id, key, identity, provider, requestedModel: config.model, requestedEffort: config.effort ?? null,
    status: 'started', startedAt: new Date().toISOString(), promptHash: callIdentity({ prompt }), costUsd: null };
  await writeRecord(recordPath, record);
  await writeFile(join(directory, 'prompt.txt'), prompt);
  const schemaPath = join(directory, 'schema.json');
  await writeFile(schemaPath, JSON.stringify(schema));
  const cwd = await mkdtemp(join(tmpdir(), 'mob-review-isolated-'));
  const started = Date.now();
  let output;
  try {
    const args = cliArguments(provider, config, { schema: provider === 'claude' ? JSON.stringify(schema) : schemaPath, allowance });
    output = await runProcess(provider, args, { cwd, input: prompt });
    await writeFile(join(directory, 'stdout'), output.stdout);
    await writeFile(join(directory, 'stderr'), output.stderr);
    if (output.failure || output.code !== 0) throw new Error(output.failure ?? `${provider} exited ${output.code}: ${output.stderr.slice(-400)}`);
    const parsed = provider === 'claude' ? parseClaude(output.stdout, outputParser) : parseCodex(output.stdout, outputParser);
    const metadata = provider === 'codex' ? await codexModelMetadata(parsed.threadId) : {};
    Object.assign(record, parsed, metadata, { status: 'complete' });
    record.modelVerified = modelMatches(provider, config.model, record.effectiveModel);
    record.effortVerified = !config.effort || record.effectiveEffort === config.effort;
  } catch (error) {
    record.status = 'error';
    record.error = error.message;
    if (provider === 'claude') record.costUsd = knownClaudeCost(output?.stdout);
  }
  record.elapsedMs = Date.now() - started;
  await rm(cwd, { recursive: true, force: true });
  if (provider === 'claude') budget.settle(allowance, record.costUsd);
  await writeRecord(recordPath, record);
  return record;
}

function knownClaudeCost(stdout) {
  try { const result = JSON.parse(stdout); return Number.isFinite(result.total_cost_usd) ? result.total_cost_usd : null; }
  catch { return null; }
}
