import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyEvidenceSources } from '../evidence.mjs';
import { hash } from '../runner-state.mjs';

test('report verifies working oracle and tier data as well as the claimed committed source', async () => {
  const source = { 'corpus.mjs': 'corpus', 'cases/backend.mjs': 'oracle', 'run.mjs': 'original queue' };
  const manifest = { files: Object.fromEntries(Object.entries(source).map(([name, text]) => [name, hash(text)])) };
  const committed = async name => source[name];
  await verifyEvidenceSources(manifest, { committed, working: async name => source[name] });
  await assert.rejects(verifyEvidenceSources(manifest, { committed, working: async name => name.startsWith('cases/') ? 'changed oracle/tier' : source[name] }), /Working corpus differs/);
  await assert.rejects(verifyEvidenceSources(manifest, { committed: async () => 'other commit', working: committed }), /Evaluated source mismatch/);
  // Post-evaluation orchestrator repairs do not change the evaluated fixture.
  await verifyEvidenceSources(manifest, { committed, working: async name => name === 'run.mjs' ? 'fixed queue' : source[name] });
});
