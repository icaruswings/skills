import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseModel, budgetAllowance, validateCodexCatalog } from '../policy.mjs';
import { reviewerPrompt, triagePrompt, schemaForLenses } from '../prompts.mjs';

test('tiered and baseline differ only in the selected model configuration', () => {
  assert.equal(chooseModel('claude', 'tiered', 'economy').model, 'haiku');
  assert.equal(chooseModel('claude', 'strong', 'economy').model, 'opus');
  assert.equal(chooseModel('codex', 'tiered', 'balanced').model, 'gpt-6-sol');
  assert.deepEqual(chooseModel('codex', 'strong', 'economy'), chooseModel('codex', 'tiered', 'strong'));
  assert.throws(() => chooseModel('codex', 'tiered', 'unknown'));
});

test('preflight rejects a model absent from the actual launching CLI catalog', () => {
  const models = ['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra'].map(slug => ({ slug, supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }] }));
  assert.equal(validateCodexCatalog({ models }).length, 3);
  assert.throws(() => validateCodexCatalog({ models: models.filter(row => row.slug !== 'gpt-6-sol') }), /catalog/i);
});

test('structured output binds canonical lens identity without combining names', () => {
  const schema = schemaForLenses(['Product', 'Staff engineer']);
  assert.deepEqual(schema.properties.findings.items.properties.lens.enum, ['Product', 'Staff engineer']);
  assert.throws(() => schemaForLenses(['Product, Staff engineer']));
});

test('review prompts exclude hidden truth, provenance, tier and scheme', () => {
  const fixture = { id: 'C01', review: { filename: 'module.js', spec: 'Return the label.', before: 'a', after: 'b', context: '' }, expected: [{ criterion: 'SECRET-ANSWER' }], provenance: { description: 'SECRET-HISTORY' } };
  const lens = { name: 'Product', tier: 'economy' };
  const prompt = reviewerPrompt(fixture, lens);
  assert.ok(prompt.includes('Return the label.'));
  for (const secret of ['SECRET-ANSWER', 'SECRET-HISTORY', 'economy', 'tiered']) assert.ok(!prompt.includes(secret));
  assert.equal(prompt, reviewerPrompt({ ...fixture, expected: [] }, { ...lens, tier: 'strong' }));
  assert.ok(triagePrompt(fixture, [{ lens: 'Product', findings: [] }]).includes('Product'));
});

test('budget reserves bound the next call and unknown spending stops execution', () => {
  assert.equal(budgetAllowance({ cap: 20, spent: 1, reserve: .2 }), .2);
  assert.throws(() => budgetAllowance({ cap: 20, spent: 19.9, reserve: .2 }), /budget/i);
  assert.throws(() => budgetAllowance({ cap: 20, spent: null, reserve: .2 }), /unknown/i);
  assert.throws(() => budgetAllowance({ cap: -1, spent: 0, reserve: .2 }));
});
