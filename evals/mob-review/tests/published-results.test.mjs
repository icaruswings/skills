import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { corpus, verifyCorpus } from '../corpus.mjs';
import { hash } from '../runner-state.mjs';
import { buildReport } from '../reporting.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../results/2026-10-29/${name}.json`, import.meta.url), 'utf8'));
const [manifest, reviews, grades, calls, summary, oracles, blinded] = await Promise.all(
  ['manifest', 'reviews', 'judgments', 'calls', 'summary', 'oracles', 'blinded-review'].map(load));

test('published pilot is a complete frozen matrix and keeps acceptance provisional', () => {
  assert.equal(manifest.matrix.length, 288);
  assert.equal(reviews.length, 288);
  assert.equal(calls.comparison.length, 888);
  assert.equal(grades.length, 24);
  assert.ok(reviews.every(panel => panel.status === 'complete' && panel.modelVerified));
  assert.equal(summary.gates.humanSignoff, false);
  assert.equal(summary.gates.qualityEquivalent, false);
  assert.deepEqual(oracles, verifyCorpus());
});

test('published metrics replay from observations, matches and all measured attempts', () => {
  const replayed = buildReport({ manifest, fixtures: corpus, panels: reviews, judgments: grades.flatMap(grade => grade.judgments),
    runCalls: calls.comparison, gradingCalls: calls.grading, campaignCalls: [...calls.comparison, ...calls.grading, ...calls.overhead],
    sourceCommit: manifest.evaluatedSourceCommit });
  for (const field of ['coverage', 'gates', 'groups', 'splits', 'pairs', 'scores', 'humanQueue', 'costComparisons']) {
    assert.deepEqual(replayed[field], summary[field], field);
  }
  for (const provider of ['claude', 'codex']) {
    const actual = replayed.resources.campaign[provider], expected = summary.resources.campaign[provider];
    for (const field of Object.keys(actual)) assert.ok(Math.abs(actual[field] - expected[field]) < 1e-7, `${provider}.${field}`);
  }
});

test('normalized call output hashes bind reviewer, triage and grader artifacts', () => {
  const byId = new Map(calls.comparison.map(call => [call.id, call]));
  for (const panel of reviews) {
    panel.reports.forEach((report, index) => {
      const review = Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'lens'));
      assert.equal(byId.get(panel.callIds[index]).reviewHash, hash(review));
    });
    assert.equal(byId.get(panel.callIds.at(-1)).reviewHash, hash(panel.triage));
  }
  const graders = new Map(calls.grading.map(call => [call.id, call]));
  for (const grade of grades) assert.equal(graders.get(grade.graderCallId).reviewHash, hash({ judgments: grade.judgments }));
});

test('human packet includes code and provisional matches without mapping fields', () => {
  assert.equal(blinded.length, 24);
  for (const entry of blinded) {
    assert.equal(entry.humanSignoff, false);
    assert.ok(entry.brief.before && entry.brief.after && entry.brief.spec);
    assert.equal(entry.panels.length, 12);
    assert.equal(entry.provisionalJudgments.length, 12);
    for (const panel of entry.panels) assert.deepEqual(Object.keys(panel).sort(), ['panelId', 'raw', 'triage']);
  }
});
