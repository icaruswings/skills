import { opaqueId } from './runner-state.mjs';

function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function keyed(entries, field, name) {
  const result = new Map();
  for (const entry of array(entries, name)) {
    const key = entry?.[field];
    if (typeof key !== 'string' || !key.trim()) throw new TypeError(`${name} require ${field}`);
    if (result.has(key)) throw new Error(`Duplicate ${name} ${field}: ${key}`);
    result.set(key, entry);
  }
  return result;
}

/** Keep every planned observation visible, including arms never attempted. */
export function completeMatrix(matrix, panels) {
  const planned = keyed(matrix, 'key', 'matrix rows');
  const observed = keyed(panels, 'key', 'panels');
  for (const key of observed.keys()) {
    if (!planned.has(key)) throw new Error(`Foreign panel key: ${key}`);
  }
  return [...planned.values()].map(row => observed.has(row.key)
    ? { ...observed.get(row.key), ...row }
    : { ...row, id: opaqueId(row.key), status: 'error', error: 'Not attempted', modelVerified: false, reports: [] });
}

const measured = value => Number.isFinite(value) && value >= 0;

/** Observed sums are lower bounds when any usage or price is unknown. */
export function resourceTotals(calls) {
  const totals = { calls: 0, failedCalls: 0, knownCostUsd: 0, unknownCostCalls: 0,
    inputTokens: 0, cachedTokens: 0, outputTokens: 0, unknownTokenCalls: 0, processSeconds: 0 };
  for (const call of array(calls, 'calls')) {
    if (!call || typeof call !== 'object' || Array.isArray(call)) throw new TypeError('Invalid call');
    totals.calls++;
    if (call.status !== 'complete') totals.failedCalls++;
    if (measured(call.costUsd)) totals.knownCostUsd += call.costUsd;
    else totals.unknownCostCalls++;
    if (measured(call.elapsedMs)) totals.processSeconds += call.elapsedMs / 1000;
    const tokens = call.tokens;
    if (!['input', 'cached', 'output'].every(field => measured(tokens?.[field]))) totals.unknownTokenCalls++;
    for (const [field, total] of [['input', 'inputTokens'], ['cached', 'cachedTokens'], ['output', 'outputTokens']]) {
      if (measured(tokens?.[field])) totals[total] += tokens[field];
    }
  }
  return totals;
}

/** Unmatched claims await human review; machine matches are not approval. */
export function humanQueue(panels, judgments, fixtures) {
  const matching = keyed(judgments, 'panelId', 'judgments');
  const observed = keyed(panels, 'id', 'panels');
  const cases = keyed(fixtures, 'id', 'fixtures');
  const queue = [];
  for (const panel of observed.values()) {
    const fixture = cases.get(panel.caseId);
    if (!fixture) throw new Error(`Unknown panel case: ${panel.caseId}`);
    const expectedIds = keyed(fixture.expected, 'id', 'expected findings');
    const reports = array(panel.reports ?? [], 'reports');
    const stages = {
      raw: reports.flatMap(report => array(report?.findings, 'report findings')),
      triage: panel.triage == null ? [] : array(panel.triage.findings, 'triage findings'),
    };
    for (const [stage, findings] of Object.entries(stages)) {
      const matches = array(matching.get(panel.id)?.[stage] ?? [], `${stage} matches`);
      const indices = new Set(matches.filter(match => expectedIds.has(match?.expectedId)
        && Number.isInteger(match.findingIndex) && match.findingIndex >= 0 && match.findingIndex < findings.length)
        .map(match => match.findingIndex));
      findings.forEach((finding, findingIndex) => {
        if (!indices.has(findingIndex)) queue.push({ panelId: panel.id, caseId: panel.caseId,
          stage, findingIndex, finding, status: 'human-pending' });
      });
    }
  }
  return queue;
}
