export function blindPayload(fixture, panels) {
  return { caseId: fixture.id, brief: fixture.review, expected: fixture.expected,
    panels: panels.map(panel => ({ panelId: panel.id, raw: panel.reports.flatMap(report => report.findings), triage: panel.triage.findings })) };
}

export function parseJudgments(value, panelIds) {
  const result = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(result?.judgments)) throw new Error('Missing judgments');
  const ids = result.judgments.map(row => row.panelId);
  if (ids.length !== panelIds.length || new Set(ids).size !== ids.length || ids.some(id => !panelIds.includes(id))) throw new Error('Missing, duplicate or unknown panel judgments');
  for (const row of result.judgments) {
    for (const stage of ['raw', 'triage']) {
      if (!Array.isArray(row[stage])) throw new Error(`Invalid ${stage} judgments`);
      for (const match of row[stage]) {
        if (typeof match.expectedId !== 'string' || !Number.isInteger(match.findingIndex) || match.findingIndex < 0) throw new Error('Invalid match');
      }
    }
    if (!Array.isArray(row.notes) || row.notes.some(note => typeof note !== 'string')) throw new Error('Invalid judgment notes');
  }
  return result;
}

export function gradingPrompt(payload) {
  return `Match review findings to independently verified expected defects. Provider, model and configuration identities are deliberately hidden.
For each opaque panelId, assess raw and triage findings separately. findingIndex is zero-based in the corresponding array.
Count a match only when the finding identifies the specific defect mechanism in the expected criterion and supports it with the supplied code/spec.
A generic warning, a suggestion to test, or merely mentioning a topic is insufficient. Match the defect regardless of which lens discovered it.
Match all duplicate findings that describe the same expected defect; metrics deduplicate them. Severity correctness is scored separately, so do not refuse a semantic match solely for severity.
Do not invent matches for a clean case. Unmatched claims remain pending human adjudication; record brief reasons in notes instead of declaring them false positives.
Use only supplied evidence, call no tools, and do not infer hidden identities. Return JSON {"judgments":[{"panelId":"...","raw":[{"expectedId":"...","findingIndex":0}],"triage":[],"notes":[]}]}.
Payload:\n${JSON.stringify(payload)}`;
}

export function judgmentSchema(panelIds) {
  const match = { type: 'object', additionalProperties: false, properties: {
    expectedId: { type: 'string' }, findingIndex: { type: 'integer', minimum: 0 },
  }, required: ['expectedId', 'findingIndex'] };
  return { type: 'object', additionalProperties: false, properties: {
    judgments: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      panelId: { type: 'string', enum: panelIds }, raw: { type: 'array', items: match }, triage: { type: 'array', items: match },
      notes: { type: 'array', items: { type: 'string' } },
    }, required: ['panelId', 'raw', 'triage', 'notes'] } },
  }, required: ['judgments'] };
}
