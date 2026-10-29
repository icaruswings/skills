import test from 'node:test';
import assert from 'node:assert/strict';
import backend from '../cases/backend.mjs';
import frontend from '../cases/interface.mjs';
import { evaluate } from '../cases/support.mjs';

const corpus = [...backend, ...frontend];
const roles = new Set(['Staff engineer', 'Security', 'Product', 'Frontend & accessibility', 'Data & contracts', 'Infrastructure', 'Operability']);

test('corpus has fixed neutral IDs, splits and six clean controls', () => {
  assert.equal(backend.length, 12);
  assert.equal(frontend.length, 12);
  assert.deepEqual(corpus.map(item => item.id), Array.from({ length: 24 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`));
  assert.equal(corpus.filter(item => item.split === 'pilot').length, 16);
  assert.equal(corpus.filter(item => item.split === 'holdout').length, 8);
  assert.equal(corpus.filter(item => item.expected.length === 0).length, 6);
});

test('holdout assignment is stratified and fixed before live evaluation', () => {
  assert.deepEqual(corpus.filter(item => item.split === 'holdout').map(item => item.id),
    ['C02', 'C03', 'C06', 'C13', 'C15', 'C20', 'C21', 'C24']);
});

for (const [split, cleanCount] of [['pilot', 4], ['holdout', 2]]) {
  test(`${split} covers all seven lenses, Economy tasks, and clean controls`, () => {
    const cases = corpus.filter(item => item.split === split);
    const lenses = cases.flatMap(item => item.lenses);
    assert.deepEqual(new Set(lenses.map(lens => lens.name)), roles);
    assert.ok(lenses.some(lens => lens.tier === 'economy'), `${split} needs Economy coverage`);
    assert.equal(cases.filter(item => item.expected.length === 0).length, cleanCount);
  });
}

test('C12 migration safety uses Strong for Data & contracts and Staff engineer', () => {
  assert.deepEqual(corpus.find(item => item.id === 'C12').lenses, [
    { name: 'Data & contracts', tier: 'strong' },
    { name: 'Staff engineer', tier: 'strong' },
  ]);
});

test('review inputs contain only neutral source and explicit contracts', () => {
  for (const item of corpus) {
    assert.deepEqual(Object.keys(item.review).sort(), ['after', 'before', 'context', 'filename', 'spec']);
    assert.equal(item.review.filename, 'module.js');
    assert.ok(item.review.before !== item.review.after);
    for (const field of ['spec', 'context', 'before', 'after']) assert.ok(item.review[field].length > 15);
    assert.doesNotMatch(JSON.stringify(item.review), /historical-adaptation|seeded-defect|expectedFinding|knownBlocker|\bC\d{2}\b|\/Users\/|icaruswings|boxd/i);
    for (const finding of item.expected) {
      assert.ok(finding.criterion.length > 60);
      assert.ok(['blocker', 'should-fix', 'optional'].includes(finding.severity));
      assert.ok(item.lenses.some(lens => lens.name === finding.lens));
    }
  }
});

test('all seven lenses are represented with valid policy tiers', () => {
  const seen = new Set();
  for (const item of corpus) for (const lens of item.lenses) {
    assert.ok(roles.has(lens.name));
    assert.ok(['economy', 'balanced', 'strong'].includes(lens.tier));
    if (lens.name === 'Security') assert.equal(lens.tier, 'strong');
    seen.add(lens.name);
  }
  assert.deepEqual(seen, roles);
  assert.ok(corpus.some(item => item.lenses.some(lens => lens.tier === 'economy')));
});

test('historical adaptations cite full repository commits and explain scope', () => {
  const historical = corpus.filter(item => item.provenance.kind === 'historical-adaptation');
  assert.ok(historical.length >= 3);
  for (const item of historical) {
    assert.match(item.provenance.reference, /^[a-f0-9]{40}$/);
    assert.ok(item.provenance.description.length > 80);
  }
});

for (const item of corpus) test(`${item.id}: executable before/after contract and connected oracle`, () => {
  const result = item.verify();
  assert.equal(result.before, true, result.evidence);
  assert.equal(result.after, item.expected.length === 0, result.evidence);
  assert.ok(result.evidence.length > 50);
  assert.deepEqual(item.verify(), result);
  const after = item.review.after;
  try {
    item.review.after = item.review.before;
    assert.equal(item.verify().after, true, 'oracle must execute the review source');
    item.review.after = 'throw new Error("oracle source execution sentinel");';
    assert.equal(item.verify().after, false, 'oracle cannot return a constant');
  } finally { item.review.after = after; }
});

test('trusted fixture execution is time bounded and has no host process', () => {
  assert.equal(evaluate('while (true) {}', '() => ({pass:true})').pass, false);
  assert.equal(evaluate('', '() => ({pass: typeof process === "undefined" && typeof require === "undefined"})').pass, true);
});
