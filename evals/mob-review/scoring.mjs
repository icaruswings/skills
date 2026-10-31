// Machine-assisted matches are provisional. Unmatched findings need human
// adjudication; these functions cannot establish quality equivalence or the
// statistical independence of repetitions.

const unique = values => [...new Set(values)];
const ids = matches => unique(matches.map(match => match.expectedId));
const difference = (left, right) => left.filter(value => !right.includes(value));

function stageMatches(stage, entries, findings, expectedIds) {
  const valid = [], invalid = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const index = entry?.findingIndex;
    const accepted = expectedIds.includes(entry?.expectedId)
      && Number.isInteger(index) && index >= 0 && index < findings.length;
    (accepted ? valid : invalid).push({ ...entry, stage });
  }
  const matches = [...new Map(valid.map(match => [`${match.expectedId}:${match.findingIndex}`, match])).values()];
  return { matches, invalid, unmatched: findings.length - unique(matches.map(match => match.findingIndex)).length };
}

function missingBlockers(expected, result, findings) {
  const found = result.matches.filter(match => findings[match.findingIndex].severity === 'blocker');
  return difference(expected.filter(item => item.severity === 'blocker').map(item => item.id), ids(found));
}

function mismatches(expected, result, findings) {
  return result.matches.flatMap(match => {
    const severity = expected.find(item => item.id === match.expectedId).severity;
    const actual = findings[match.findingIndex].severity;
    return actual === severity ? [] : [{
      stage: match.stage, expectedId: match.expectedId, findingIndex: match.findingIndex,
      expected: severity, actual,
    }];
  });
}

function lensScores(expected, raw, final, rawMatches, finalMatches) {
  const lenses = unique([...expected.map(item => item.lens), ...raw.map(item => item.lens), ...final.map(item => item.lens)]);
  return lenses.map(lens => ({
    lens,
    expectedIds: expected.filter(item => item.lens === lens).map(item => item.id),
    detectedIds: ids(rawMatches.matches.filter(match => raw[match.findingIndex].lens === lens)),
    retainedIds: ids(finalMatches.matches.filter(match => final[match.findingIndex].lens === lens)),
  }));
}

function incompleteReasons(fixture, panel, judgment) {
  const reasons = [];
  if (panel.status !== 'complete') reasons.push('panel-error-or-incomplete');
  if (panel.modelVerified !== true) reasons.push('model-unverified');
  if (panel.caseId !== fixture.id) reasons.push('case-mismatch');
  if (!Array.isArray(panel.reports) || !panel.reports.every(report => Array.isArray(report.findings))) reasons.push('reports-missing');
  if (!Array.isArray(panel.triage?.findings)) reasons.push('triage-missing');
  if (judgment?.panelId !== panel.id || !Array.isArray(judgment?.raw) || !Array.isArray(judgment?.triage)) reasons.push('judgment-missing-or-mismatched');
  return reasons;
}

/** Score only explicit independent matches; never infer a false positive. */
export function scorePanel(fixture, panel, judgment) {
  const expectedIds = fixture.expected.map(item => item.id);
  const raw = (panel.reports ?? []).flatMap(report => report.findings ?? []);
  const final = panel.triage?.findings ?? [];
  const reasons = incompleteReasons(fixture, panel, judgment);
  const matchingJudgment = judgment?.panelId === panel.id ? judgment : null;
  const rawResult = stageMatches('raw', matchingJudgment?.raw, raw, expectedIds);
  const finalResult = stageMatches('triage', matchingJudgment?.triage, final, expectedIds);
  const invalidMatches = [...rawResult.invalid, ...finalResult.invalid];
  if (invalidMatches.length) reasons.push('invalid-judgment-matches');
  const detectedIds = ids(rawResult.matches), retainedIds = ids(finalResult.matches);
  const rawMissedBlockerIds = missingBlockers(fixture.expected, rawResult, raw);
  const finalMissedBlockerIds = missingBlockers(fixture.expected, finalResult, final);
  return {
    panelId: panel.id, caseId: panel.caseId, split: fixture.split,
    provider: panel.provider, scheme: panel.scheme, repetition: panel.repetition,
    complete: reasons.length === 0, incompleteReasons: reasons, invalidMatches,
    expectedIds, knownBlockerIds: fixture.expected.filter(item => item.severity === 'blocker').map(item => item.id),
    detectedIds, retainedIds, missedIds: difference(expectedIds, retainedIds),
    missedBlockerIds: unique([...rawMissedBlockerIds, ...finalMissedBlockerIds]),
    rawMissedBlockerIds, finalMissedBlockerIds,
    triageLostIds: difference(detectedIds, retainedIds),
    severityMismatches: [...mismatches(fixture.expected, rawResult, raw), ...mismatches(fixture.expected, finalResult, final)],
    unmatchedRaw: rawResult.unmatched, unmatchedFinal: finalResult.unmatched,
    cleanCaseAlarms: expectedIds.length === 0 ? final.length : 0,
    adjudicationStatus: 'human-pending',
    perLens: lensScores(fixture.expected, raw, final, rawResult, finalResult),
  };
}

function groupBy(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify(fields.map(field => row[field]));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

const countIds = (rows, field) => rows.reduce((sum, row) => sum + row[field].length, 0);
const total = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0);
const uniqueCaseDefects = (rows, field) => unique(rows.flatMap(row => row[field].map(id => JSON.stringify([row.caseId, id])))).length;

function summarizeLenses(rows) {
  const lenses = rows.flatMap(row => row.perLens);
  return groupBy(lenses, ['lens']).map(group => ({
    lens: group[0].lens,
    knownDefects: countIds(group, 'expectedIds'),
    detectedDefects: countIds(group, 'detectedIds'),
    retainedDefects: countIds(group, 'retainedIds'),
  }));
}

function summarizeGroup(rows) {
  const knownDefects = countIds(rows, 'expectedIds');
  const retainedDefects = countIds(rows, 'retainedIds');
  const incompleteObservations = rows.filter(row => !row.complete).length;
  const missedBlockers = countIds(rows, 'missedBlockerIds');
  const unmatchedRaw = total(rows, 'unmatchedRaw'), unmatchedFinal = total(rows, 'unmatchedFinal');
  return {
    provider: rows[0].provider, scheme: rows[0].scheme,
    observations: rows.length, uniqueCases: unique(rows.map(row => row.caseId)).length,
    completeObservations: rows.length - incompleteObservations, incompleteObservations,
    knownDefects, uniqueKnownDefects: uniqueCaseDefects(rows, 'expectedIds'),
    knownBlockers: countIds(rows, 'knownBlockerIds'), uniqueKnownBlockers: uniqueCaseDefects(rows, 'knownBlockerIds'),
    detectedDefects: countIds(rows, 'detectedIds'), retainedDefects,
    knownDefectRecall: knownDefects === 0 ? null : retainedDefects / knownDefects,
    missedBlockers, triageLosses: countIds(rows, 'triageLostIds'),
    severityMismatches: countIds(rows, 'severityMismatches'), unmatchedRaw, unmatchedFinal,
    cleanCaseAlarms: total(rows, 'cleanCaseAlarms'),
    machineGatePassed: incompleteObservations === 0 && missedBlockers === 0 && unmatchedRaw === 0 && unmatchedFinal === 0,
    humanSignoff: false, qualityEquivalent: false,
    adjudicationStatus: 'human-pending',
    perLens: summarizeLenses(rows),
    splits: groupBy(rows, ['split']).map(group => ({
      split: group[0].split, observations: group.length, uniqueCases: unique(group.map(row => row.caseId)).length,
    })),
  };
}

/** Observation totals are repeated measurements, not independent samples. */
export function summarize(scores) {
  return groupBy(scores, ['provider', 'scheme']).map(summarizeGroup);
}

function comparePair(rows) {
  const tiered = rows.filter(row => row.scheme === 'tiered');
  const strong = rows.filter(row => row.scheme === 'strong');
  const complete = tiered.length === 1 && strong.length === 1 && tiered[0].complete && strong[0].complete;
  const added = complete ? difference(tiered[0].missedBlockerIds, strong[0].missedBlockerIds) : null;
  return {
    provider: rows[0].provider, caseId: rows[0].caseId, repetition: rows[0].repetition,
    tieredPanelIds: tiered.map(row => row.panelId), strongPanelIds: strong.map(row => row.panelId),
    complete,
    addedMissedBlockerIds: added,
    baselineOnlyMissedBlockerIds: complete ? difference(strong[0].missedBlockerIds, tiered[0].missedBlockerIds) : null,
    sharedMissedBlockerIds: complete ? tiered[0].missedBlockerIds.filter(id => strong[0].missedBlockerIds.includes(id)) : null,
    zeroAddedMissedBlockers: complete ? added.length === 0 : null,
  };
}

/** Missing or duplicate arms withhold the paired gate instead of implying parity. */
export function comparePairs(scores) {
  return groupBy(scores, ['provider', 'caseId', 'repetition']).map(comparePair);
}
