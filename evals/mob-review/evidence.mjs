import { isDeepStrictEqual } from 'node:util';
import { hash, callIdentity, opaqueId } from './runner-state.mjs';
import { blindPayload, gradingPrompt, judgmentSchema, parseJudgments } from './grading.mjs';

// Verify published provenance and the working fixtures actually used by report.
export async function verifyEvidenceSources(manifest, { committed, working }) {
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (hash(await committed(name)) !== expected) throw new Error(`Evaluated source mismatch: ${name}`);
    if ((name === 'corpus.mjs' || name.startsWith('cases/')) && hash(await working(name)) !== expected) {
      throw new Error(`Working corpus differs from evaluated source: ${name}`);
    }
  }
}

/** Bind provisional matches to the exact verified Strong call that produced them. */
export function verifyGradingEvidence({ fixture, panels, grade, call, expectedGraderHash, runtimeHash, config }) {
  const requireMatch = (condition, detail) => {
    if (!condition) throw new Error(`Invalid grading evidence for ${fixture.id}: ${detail}`);
  };
  requireMatch(typeof expectedGraderHash === 'string' && expectedGraderHash.length > 0
    && typeof runtimeHash === 'string' && runtimeHash.length > 0, 'expected source hashes missing');
  requireMatch(typeof config?.model === 'string' && config.model.length > 0
    && typeof config.effort === 'string' && config.effort.length > 0, 'expected Strong configuration missing');
  const complete = panels.filter(panel => panel.caseId === fixture.id
    && panel.status === 'complete' && panel.modelVerified === true).sort((a, b) => a.id.localeCompare(b.id));
  const payload = blindPayload(fixture, complete), payloadHash = hash(payload);
  requireMatch(grade?.caseId === fixture.id && grade.payloadHash === payloadHash, 'stale or mismatched payload');
  requireMatch(grade.graderHash === expectedGraderHash, 'grader source hash mismatch');
  requireMatch(grade.runtimeHash === runtimeHash, 'runtime hash mismatch');
  const panelIds = complete.map(panel => panel.id);
  parseJudgments(grade, panelIds);
  if (!complete.length) {
    requireMatch(grade.graderCallId === null && call == null, 'unexpected call for empty payload');
    return;
  }

  const provider = 'codex', key = `grading:${fixture.id}:${payloadHash}`;
  const prompt = gradingPrompt(payload), schema = judgmentSchema(panelIds);
  const identity = callIdentity({ key, provider, config, prompt, schema, executionHash: expectedGraderHash });
  requireMatch(call?.id === opaqueId(key) && grade.graderCallId === call.id, 'grader call ID mismatch');
  requireMatch(call.provider === provider && call.status === 'complete'
    && call.modelVerified === true && call.effortVerified === true, 'grader call incomplete or unverified');
  requireMatch(call.requestedModel === config.model && call.effectiveModel === config.model
    && call.requestedEffort === config.effort && call.effectiveEffort === config.effort, 'grader Strong configuration mismatch');
  requireMatch(call.key === key && call.promptHash === callIdentity({ prompt })
    && call.identity === identity, 'grader call inputs mismatch');
  parseJudgments(call.review, panelIds);
  requireMatch(isDeepStrictEqual(grade.judgments, call.review.judgments), 'judgments differ from grader call');
}
