import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../../skills/mob-review/SKILL.md', import.meta.url), 'utf8');
export const lensNames = skill.split('\n').filter(line => line.startsWith('| **') && line.split('|').length === 5)
  .map(line => line.split('|')[1].trim().replaceAll('**', ''));
const contract = `Review the supplied change using only the assigned lens. Evidence is complete for this synthetic fixture.
Report introduced defects supported by the spec and code. Respect explicit input/environment constraints.
blocker = data loss, security hole, broken contract, or user-facing break; otherwise should-fix or optional.
Keep evidence and locations precise. Record verification gaps separately. Change no files and call no tools.
Return JSON only: {"findings":[{"lens":"assigned lens","severity":"blocker|should-fix|optional","title":"...","evidence":"...","location":"..."}],"gaps":[]}.`;

function lensScope(name) {
  const row = skill.split('\n').find(line => line.startsWith(`| **${name}** |`));
  if (!row) throw new Error(`Unknown review lens: ${name}`);
  return row.split('|')[3].trim();
}

export function reviewerPrompt(fixture, lens) {
  return `${contract}\nAssigned lens: ${lens.name}\nChecks: ${lensScope(lens.name)}\nReview brief:\n${JSON.stringify(fixture.review)}`;
}

export function triagePrompt(fixture, reports) {
  return `${contract}\nAssigned task: final triage across the supplied lens reports.
Reconcile duplicate findings, conflicting evidence and severity. Preserve the source lens on retained findings.
Use one selected canonical lens name in each finding.lens; preserve other source lenses in the evidence when merging duplicates.
Assess the reports against the original code and spec; retain supported defects and remove unsupported claims.
Review brief:\n${JSON.stringify(fixture.review)}\nIndependent lens reports:\n${JSON.stringify(reports)}`;
}

const findingProperties = Object.fromEntries(['title', 'evidence', 'location'].map(key => [key, { type: 'string' }]));
export const reviewSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { ...findingProperties, lens: { type: 'string', enum: lensNames }, severity: { type: 'string', enum: ['blocker', 'should-fix', 'optional'] } },
      required: ['lens', 'severity', 'title', 'evidence', 'location'] } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'gaps'],
};

export function schemaForLenses(names) {
  if (!names.length || names.some(name => !lensNames.includes(name))) throw new Error('Unknown canonical lens');
  const schema = structuredClone(reviewSchema);
  schema.properties.findings.items.properties.lens.enum = names;
  return schema;
}
