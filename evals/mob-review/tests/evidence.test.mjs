import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyEvidenceSources, verifyGradingEvidence } from '../evidence.mjs';
import { hash, callIdentity, opaqueId } from '../runner-state.mjs';
import { blindPayload, gradingPrompt, judgmentSchema } from '../grading.mjs';

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

function gradingEvidence() {
  const fixture = { id: 'C01', review: { spec: 'Keep the existing contract' },
    expected: [{ id: 'E01', severity: 'blocker', criterion: 'Specific contract defect' }] };
  const finding = { lens: 'Staff engineer', severity: 'blocker', title: 'Defect', evidence: 'Specific evidence', location: 'module.js:1' };
  const panel = id => ({ id, caseId: fixture.id, status: 'complete', modelVerified: true,
    reports: [{ findings: [finding] }], triage: { findings: [finding] } });
  const panels = [panel('b'), { ...panel('incomplete'), status: 'error' }, panel('a'),
    { ...panel('unverified'), modelVerified: false }, { ...panel('other-case'), caseId: 'C02' }];
  const complete = [panels[2], panels[0]], panelIds = ['a', 'b'];
  const expectedGraderHash = 'expected-grader-source', runtimeHash = 'frozen-runtime';
  const config = { model: 'gpt-6-astra', effort: 'high' };
  const payload = blindPayload(fixture, complete), payloadHash = hash(payload);
  const key = `grading:${fixture.id}:${payloadHash}`, provider = 'codex';
  const prompt = gradingPrompt(payload), schema = judgmentSchema(panelIds);
  const judgments = panelIds.map(panelId => ({ panelId,
    raw: [{ expectedId: 'E01', findingIndex: 0 }], triage: [{ expectedId: 'E01', findingIndex: 0 }], notes: [] }));
  const call = { id: opaqueId(key), provider, key,
    identity: callIdentity({ key, provider, config, prompt, schema, executionHash: expectedGraderHash }),
    promptHash: callIdentity({ prompt }), status: 'complete', modelVerified: true, effortVerified: true,
    requestedModel: config.model, effectiveModel: config.model, requestedEffort: config.effort, effectiveEffort: config.effort,
    review: { judgments } };
  const grade = { caseId: fixture.id, payloadHash, graderHash: expectedGraderHash, runtimeHash,
    graderCallId: call.id, judgments: structuredClone(judgments) };
  return { fixture, panels, grade, call, expectedGraderHash, runtimeHash, config };
}

test('grading evidence binds canonical complete panels to their verified Strong call', () => {
  const evidence = gradingEvidence();
  assert.doesNotThrow(() => verifyGradingEvidence(evidence));
  assert.doesNotThrow(() => verifyGradingEvidence({ ...evidence, panels: [...evidence.panels].reverse() }));
});

test('grading evidence rejects changed matches and stale reviewed payloads', () => {
  const changedMatches = gradingEvidence();
  changedMatches.grade.judgments[0].triage = [];
  assert.throws(() => verifyGradingEvidence(changedMatches), /judgments differ/);
  const changedPayload = gradingEvidence();
  changedPayload.panels[0].triage.findings = [];
  assert.throws(() => verifyGradingEvidence(changedPayload), /payload/);
  const missingJudgment = gradingEvidence();
  missingJudgment.grade.judgments.pop();
  assert.throws(() => verifyGradingEvidence(missingJudgment), /panel judgments/);
});

test('grading evidence rejects wrong source hashes and call identity', () => {
  for (const field of ['graderHash', 'runtimeHash', 'payloadHash', 'graderCallId', 'caseId']) {
    const evidence = gradingEvidence();
    evidence.grade[field] = 'wrong';
    assert.throws(() => verifyGradingEvidence(evidence), /Invalid grading evidence/, field);
  }
  for (const field of ['id', 'key', 'identity', 'promptHash']) {
    const evidence = gradingEvidence();
    evidence.call[field] = 'wrong';
    assert.throws(() => verifyGradingEvidence(evidence), /Invalid grading evidence/, field);
  }
  assert.throws(() => verifyGradingEvidence({ ...gradingEvidence(), call: undefined }), /call ID/);
});

test('grading evidence rejects incomplete, unverified, or different model calls', () => {
  for (const [field, value] of [['status', 'error'], ['provider', 'claude'], ['modelVerified', false],
    ['effortVerified', false], ['requestedModel', 'gpt-6-sol'], ['effectiveModel', 'gpt-6-sol'],
    ['requestedEffort', 'medium'], ['effectiveEffort', 'medium']]) {
    const evidence = gradingEvidence();
    evidence.call[field] = value;
    assert.throws(() => verifyGradingEvidence(evidence), /Invalid grading evidence/, field);
  }
});

test('empty grading evidence requires no call and no judgments', () => {
  const evidence = gradingEvidence();
  evidence.panels = [];
  evidence.call = null;
  evidence.grade = { ...evidence.grade, payloadHash: hash(blindPayload(evidence.fixture, [])), graderCallId: null, judgments: [] };
  assert.doesNotThrow(() => verifyGradingEvidence(evidence));
  assert.throws(() => verifyGradingEvidence({ ...evidence, call: gradingEvidence().call }), /unexpected call/);
  assert.throws(() => verifyGradingEvidence({ ...evidence, grade: { ...evidence.grade, judgments: gradingEvidence().grade.judgments } }), /panel judgments/);
});
