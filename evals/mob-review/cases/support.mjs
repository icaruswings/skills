import { runInNewContext } from 'node:vm';

// Freeze before live evaluation; each split includes every lens and Economy tasks.
const holdoutIds = new Set(['C02', 'C03', 'C06', 'C13', 'C15', 'C20', 'C21', 'C24']);

// This executor only accepts trusted, committed fixtures. Never pass model output.
export function evaluate(source, probe) {
  try {
    return JSON.parse(runInNewContext(`${source}\nJSON.stringify((${probe})())`, {}, {
      timeout: 100, contextCodeGeneration: { strings: false, wasm: false },
    }));
  } catch (error) {
    return { pass: false, observed: error.message };
  }
}

export function fixture({ id, spec, context, before, after, lenses, expected = [], provenance, probe }) {
  const review = { filename: 'module.js', spec, context, before: before.trim(), after: after.trim() };
  return {
    id, split: holdoutIds.has(id) ? 'holdout' : 'pilot',
    provenance: provenance ?? {
      kind: expected.length ? 'seeded-defect' : 'clean-control',
      reference: 'original synthetic example',
      description: 'Minimal JavaScript written for this evaluation; no application source or private data.',
    },
    review, lenses: lenses.map(([name, tier]) => ({ name, tier })), expected,
    verify() {
      const beforeResult = evaluate(review.before, probe);
      const afterResult = evaluate(review.after, probe);
      return { before: beforeResult.pass === true, after: afterResult.pass === true,
        evidence: JSON.stringify({ before: beforeResult, after: afterResult }) };
    },
  };
}

export function finding(id, lens, criterion, severity = 'blocker') {
  return { id, severity, lens, criterion };
}

export function history(reference, description) {
  return { kind: 'historical-adaptation', reference, description };
}
