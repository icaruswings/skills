import backend from './cases/backend.mjs';
import frontend from './cases/interface.mjs';

export const corpus = [...backend, ...frontend].sort((a, b) => a.id.localeCompare(b.id));

export function verifyCorpus(cases = corpus) {
  return cases.map(fixture => {
    const result = fixture.verify();
    if (!result.before || result.after !== (fixture.expected.length === 0)) throw new Error(`Invalid oracle for ${fixture.id}: ${result.evidence}`);
    return { id: fixture.id, expected: fixture.expected, provenance: fixture.provenance, ...result };
  });
}
