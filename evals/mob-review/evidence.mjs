import { hash } from './runner-state.mjs';

// Verify published provenance and the working fixtures actually used by report.
export async function verifyEvidenceSources(manifest, { committed, working }) {
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (hash(await committed(name)) !== expected) throw new Error(`Evaluated source mismatch: ${name}`);
    if ((name === 'corpus.mjs' || name.startsWith('cases/')) && hash(await working(name)) !== expected) {
      throw new Error(`Working corpus differs from evaluated source: ${name}`);
    }
  }
}
